import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const source=execFileSync('git',['show','d7c00e9d39925c63072692f2a43d2ba0228d662a:lib/executed-volume-audit.mjs']);
const e=await import('data:text/javascript;base64,'+source.toString('base64'));
const csv=execFileSync('python',['-c',[
  'import hashlib,pathlib,sys,zipfile',
  'p=pathlib.Path("audit-results/raw/BTCUSDT-trades-2017-08-19.zip")',
  'assert hashlib.sha256(p.read_bytes()).hexdigest()=="ff74fae2822aea541f55e68c9b3c7c6387f636827f403239869aa2be7578d6a6"',
  'with zipfile.ZipFile(p) as z: sys.stdout.buffer.write(z.read(z.namelist()[0]))'
].join('\n')],{encoding:'utf8'});
const r=e.parseExecutions(csv);
for(const tick of ['0.1','1','10']){
 const a=e.aggregate(r,{tick}); const p=e.profile(a);
 assert.equal(e.decimal(p.total),'381.309763');
 let foot=0n;for(const m of a.footprint.values())for(const c of m.values())foot+=c.buy+c.sell;
 assert.equal(foot,p.total);
 assert.equal(e.decimal(e.cvdByMinute(a).at(-1).cvd),'167.362321');
 if(tick==='1')assert.deepEqual([p.poc,p.val,p.vah].map(e.decimal),['4046','3850','4111']);
 console.log(tick,[p.poc,p.val,p.vah].map(e.decimal),e.decimal(foot));
}
