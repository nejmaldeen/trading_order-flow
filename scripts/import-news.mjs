import {collectMonth,fetchText} from '../lib/news-archive.ts';
import {writeFile,mkdir} from 'node:fs/promises';
const index=new Map();
const read=url=>{if(url.includes('/bls/news-release/')||url.endsWith('fomccalendars.htm')){if(!index.has(url))index.set(url,fetchText(url));return index.get(url);}return fetchText(url);};
const now=new Date(),end=now.toISOString().slice(0,7),tasks=[];
for(let y=2017;y<=now.getUTCFullYear();y++)for(let m=1;m<=12;m++){
 const month=`${y}-${String(m).padStart(2,'0')}`;if(month>end)continue;
 for(const source of ['cpi','empsit','fed'])tasks.push({month,source});
}
const output={fetchedAt:now.toISOString(),months:{}};let done=0;
async function worker(){while(tasks.length){const {source,month}=tasks.shift();try{output.months[source+':'+month]={records:await collectMonth(source,month,read)};}catch(e){output.months[source+':'+month]={records:[],error:e.message};}done++;if(done%30===0)console.log('Archived',done);}}
await Promise.all([worker(),worker(),worker()]);
await mkdir('data',{recursive:true});await writeFile('data/news-archive.json',JSON.stringify(output));
const values=Object.values(output.months);console.log(JSON.stringify({months:values.length,successful:values.filter(x=>!x.error).length,records:values.reduce((n,x)=>n+x.records.length,0),failures:Object.entries(output.months).filter(([k,x])=>x.error).map(([k,x])=>[k,x.error])}));
