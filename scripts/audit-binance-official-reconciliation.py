#!/usr/bin/env python3
"""Read-only integrity audit of official Binance BTCUSDT Spot trades, aggTrades and 1m klines."""
import csv, datetime as dt, hashlib, io, json, os, pathlib, resource, time, urllib.request, zipfile
from collections import Counter, defaultdict
from decimal import Decimal
BASE="https://data.binance.vision/data/spot/daily"; SCALE=100000000; MIN_US=60000000
def fixed(s):
    n=Decimal(s)*SCALE
    if not n.is_finite() or n!=int(n): raise ValueError("Precision mismatch: "+s)
    return int(n)
def show(n): return str(Decimal(n)/SCALE)
def micros(s):
    x=int(s)
    if 10**12 <= x < 10**13: return x*1000
    if 10**15 <= x < 10**16: return x
    raise ValueError("Invalid millis/micros: "+s)
def source(kind, day):
    name=(f"BTCUSDT-1m-{day}" if kind=="klines" else f"BTCUSDT-{kind}-{day}")+".zip"
    url=f"{BASE}/{kind}/BTCUSDT/"+("1m/" if kind=="klines" else "")+name
    root=pathlib.Path("audit-results/raw");root.mkdir(parents=True,exist_ok=True)
    data=root/name; chk=root/(name+".CHECKSUM")
    for u,p in [(url,data),(url+".CHECKSUM",chk)]:
        if not p.exists():
            req=urllib.request.Request(u,headers={"User-Agent":"TradingLabResearchAudit/1.0"})
            with urllib.request.urlopen(req, timeout=120) as inp, open(str(p)+".part","wb") as out:
                import shutil
                shutil.copyfileobj(inp,out,2**20)
            os.replace(str(p)+".part",p)
    expected=chk.read_text().split()[0].lower()
    digest=hashlib.sha256()
    with data.open("rb") as fh:
        for block in iter(lambda:fh.read(2**20),b""): digest.update(block)
    got=digest.hexdigest()
    if got!=expected: raise ValueError(f"SHA256 mismatch {name} expected {expected} got {got}")
    meta={"file":name,"url":url,"sha256":got,"zipBytes":data.stat().st_size}
    print("FILE_VALIDATED",json.dumps(meta),flush=True)
    return data,meta
def csvrows(path):
    with zipfile.ZipFile(path) as z:
        names=[n for n in z.namelist() if n.endswith(".csv")]
        if len(names)!=1: raise ValueError("Expected one CSV in "+str(path))
        with z.open(names[0]) as fh:
            for r in csv.reader(io.TextIOWrapper(fh, encoding="utf-8-sig",newline="")):
                if r and r[0].isdigit():yield r
def blank():return {"buy":0,"sell":0,"count":0,"open":None,"high":None,"low":None,"close":None}
def add(b,p,q,side,n):
    b[side]+=q;b["count"]+=n
    if b["open"] is None:b["open"]=p
    b["high"]=p if b["high"] is None else max(b["high"],p)
    b["low"]=p if b["low"] is None else min(b["low"],p)
    b["close"]=p
def parse_exec(path,kind,day_start):
    agg=kind=="aggTrades"; bars=defaultdict(blank); price=defaultdict(int) if not agg else None
    fp=defaultdict(lambda: [0,0]) if not agg else None
    stats=Counter();prev_id=prev_last=prev_t=None
    for r in csvrows(path):
        if len(r)<(7 if agg else 6):raise ValueError("Invalid execution row")
        iid=int(r[0]);p=fixed(r[1]);q=fixed(r[2])
        first=int(r[3]) if agg else iid
        last=int(r[4]) if agg else iid
        t=micros(r[5] if agg else r[4]);flag=(r[6] if agg else r[5]).lower()
        if flag not in ("true","false"):raise ValueError("Unrecognized maker flag")
        if not day_start<=t<day_start+86400*1000000:stats["outsideDay"]+=1
        if prev_id is not None:
            if iid==prev_id:stats["duplicates"]+=1
            if t<prev_t or (t==prev_t and iid<=prev_id):stats["reordered"]+=1
            if agg:
                if first>prev_last+1:stats["idGaps"]+=first-prev_last-1
                if first<=prev_last:stats["overlaps"]+=1
            elif iid>prev_id+1:stats["idGaps"]+=iid-prev_id-1
        prev_id=iid;prev_last=last;prev_t=t
        m=t//MIN_US*MIN_US;side="sell" if flag=="true" else "buy"
        add(bars[m],p,q,side,last-first+1 if agg else 1)
        stats["rows"]+=1;stats["originalTrades"]+=last-first+1
        if price is not None:
            bucket=p//SCALE*SCALE
            price[bucket]+=q
            if day_start+60*MIN_US<=t<day_start+65*MIN_US:
                fp[(m,bucket)][0 if side=="buy" else 1]+=q
    return bars,price,fp,dict(stats)
def parse_klines(path, day_start):
    out={}
    for r in csvrows(path):
        if len(r)<11:raise ValueError("Invalid 1m Kline row")
        t=micros(r[0])
        if t in out:raise ValueError("Duplicate minute in Klines")
        out[t]={"open":fixed(r[1]),"high":fixed(r[2]),"low":fixed(r[3]),"close":fixed(r[4]),
                "volume":fixed(r[5]),"count":int(r[8]),"buy":fixed(r[9])}
    expected=set(range(day_start,day_start+86400*1000000,MIN_US))
    if set(out)!=expected:raise ValueError("Missing Klines or wrong 1m timestamps")
    return out
def audit(day):
    start=int(dt.datetime.strptime(day,"%Y-%m-%d").replace(tzinfo=dt.timezone.utc).timestamp())*1000000
    src={};files=[]
    for name in ("trades","aggTrades","klines"):
        src[name],meta=source(name,day);files.append(meta)
    k=parse_klines(src["klines"],start)
    raw,byprice,foot,rs=parse_exec(src["trades"],"trades",start)
    agg,_,_,ags=parse_exec(src["aggTrades"],"aggTrades",start)
    issues=Counter();examples=[]
    def test(field,minute,a,b):
        if a!=b:
            issues[field]+=1
            if len(examples)<30:examples.append({"minuteUs":str(minute),"field":field,"observed":str(a),"reference":str(b)})
    for minute,v in k.items():
        tr=raw.get(minute);ar=agg.get(minute)
        if not tr or not ar:
            if v["volume"]>0:issues["missingMinute"]+=1
            continue
        for field in ("open","high","low","close","count"):
            test("kline."+field,minute,tr[field],v[field])
        test("kline.volume",minute,tr["buy"]+tr["sell"],v["volume"])
        test("kline.takerBuyVolume",minute,tr["buy"],v["buy"])
        for field in ("buy","sell","count"):
            test("agg."+field,minute,ar[field],tr[field])
    for srcname,st in (("trades",rs),("aggTrades",ags)):
        for issue in ("idGaps","duplicates","reordered","overlaps","outsideDay"):
            if st.get(issue):issues[srcname+"."+issue]+=st[issue]
    test("all.tradeMinutes",0,len(raw),len(k))
    test("all.aggMinutes",0,len(agg),len(k))
    total=sum(byprice.values());peak=max(byprice.values());poc=min(x for x,v in byprice.items() if v==peak)
    left=right=poc;target=(total*70+99)//100;inside=byprice[poc]
    minimum=min(byprice);maximum=max(byprice)
    while inside<target and (left>minimum or right<maximum):
        l=byprice.get(left-SCALE,-1) if left>minimum else -1
        r=byprice.get(right+SCALE,-1) if right<maximum else -1
        if l>=r:left-=SCALE;inside+=max(l,0)
        else:right+=SCALE;inside+=max(r,0)
    h=collections_sum(raw,"buy");s=collections_sum(raw,"sell")
    report={"day":day,"files":files,"klines":len(k),"tradesStats":rs,"aggStats":ags,
      "totalExecutedVolume":show(total),"takerBuyVolume":show(h),"takerSellVolume":show(s),
      "finalCVD":show(h-s),"volumeProfile":{"bucketSize":"1","POC":show(poc),"VAH":show(right),"VAL":show(left),"coveredPct":round(100*inside/total,5)},
      "footprint5minCells":len(foot),"footprint5minVolume":show(sum(a+b for a,b in foot.values())),
      "issues":dict(issues),"sampleIssues":examples,"peakRssKiB":__import__("resource").getrusage(__import__("resource").RUSAGE_SELF).ru_maxrss}
    print("DAY_RESULT",json.dumps(report),flush=True)
    return report
def collections_sum(d,k):return sum(b[k] for b in d.values())
if __name__=="__main__":
    ts=time.perf_counter()
    reports=[]
    try:
        for day in ("2017-08-19","2025-01-11"):reports.append(audit(day))
        pathlib.Path("audit-results/official-report.json").write_text(json.dumps(reports,indent=2)+"\n")
        print("SECONDS_TOTAL",round(time.perf_counter()-ts,3))
        if any(x["issues"] for x in reports):raise SystemExit(2)
        print("FINAL_VERDICT PASS")
    except Exception as ex:
        pathlib.Path("audit-results").mkdir(exist_ok=True)
        pathlib.Path("audit-results/official-report.json").write_text(json.dumps({"completed":reports,"error":str(ex)},indent=2))
        print("FINAL_VERDICT BLOCKED",repr(ex),flush=True)
        raise
