"""Benchmark UTC prefixes against checksummed local archives (separate process per run)."""
import argparse
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location("official_audit", Path(__file__).with_name("audit-binance-official-reconciliation.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

def peak_kib():
    if os.name != "nt":
        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    import ctypes
    from ctypes import wintypes
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (key, ctypes.c_size_t) for key in ("peak", "working", "a","b","c","d","e","f")]
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    if not ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.c_void_p(-1), ctypes.byref(counters), counters.cb):
        raise ctypes.WinError()
    return counters.peak // 1024

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("day",choices=["2017-08-19","2025-01-11"])
    parser.add_argument("minutes",type=int,choices=[1,5,60,1440])
    args = parser.parse_args()
    started = time.perf_counter()
    if args.minutes == 1440:
        result = audit.audit(args.day)
        rows = result["tradesStats"]["rows"]
        levels = result["occupiedBuckets"]
        if result["issues"]: raise ValueError(result["issues"])
    else:
        path,_ = audit.source("trades",args.day)
        start = int(dt.datetime.fromisoformat(args.day).replace(tzinfo=dt.timezone.utc).timestamp())*1000000
        bars,prices,_,stats = audit.parse_exec(path,"trades",start,start+args.minutes*audit.MIN_US)
        rows,levels = stats["rows"],len(prices)
        if sum(prices.values()) != sum(b["buy"]+b["sell"] for b in bars.values()):
            raise ValueError("Volume conservation failed")
    print(json.dumps(dict(day=args.day,minutes=args.minutes,rows=rows,levels=levels,seconds=time.perf_counter()-started,peakKiB=peak_kib())))

