import {readFile,writeFile} from 'node:fs/promises';
import {collectMonth,fetchText} from '../lib/news-archive.ts';
const file=new URL('../data/news-archive.json',import.meta.url);
const archive=JSON.parse(await readFile(file,'utf8'));
const now=new Date(),end=now.toISOString().slice(0,7),tasks=[];
const index=await fetchText('https://www.bls.gov/bls/news-release/ppi.htm');
const read=url=>url.endsWith('/bls/news-release/ppi.htm')?Promise.resolve(index):fetchText(url);
for(let y=2017;y<=now.getUTCFullYear();y++)for(let m=1;m<=12;m++){
 const month=`${y}-${String(m).padStart(2,'0')}`;if(month<=end)tasks.push(month);
}
let done=0;
async function worker(){while(tasks.length){const month=tasks.shift(),key='ppi:'+month;
 try{archive.months[key]={records:await collectMonth('ppi',month,read)};}
 catch(e){archive.months[key]={records:archive.months[key]?.records??[],error:e.message};}
 if(++done%20===0)console.log('PPI months:',done);
}}
await Promise.all([worker(),worker(),worker()]);
archive.fetchedAt=now.toISOString();await writeFile(file,JSON.stringify(archive));
const values=Object.entries(archive.months).filter(([k])=>k.startsWith('ppi:'));
console.log(JSON.stringify({months:values.length,records:values.reduce((n,[,v])=>n+v.records.length,0),errors:values.filter(([,v])=>v.error).map(([k,v])=>[k,v.error])}));
