import {collectMonth,type NewsRecord,type NewsSource} from './news-archive.ts';
import snapshot from '../data/news-archive.json';
type Cached={records:NewsRecord[];error?:string};
const pending=new Map<string,Promise<Cached>>();

function getWorkerDb(): any {
  try {
    // @ts-ignore
    const workers = require('cloudflare:workers');
    return workers?.env?.DB ?? null;
  } catch {
    return null;
  }
}

export async function archiveMonth(kind:NewsSource,month:string):Promise<Cached>{
  const key=kind+':'+month;
  // Bundled on the server only: original releases survive upstream blocking and reloads.
  const archived=(snapshot.months as Record<string,Cached>)[key];
  if(archived&&!archived.error&&month<new Date().toISOString().slice(0,7))return archived;

  const db=getWorkerDb();
  if(!db) {
    return archived ?? { records: [] };
  }

  const previous = (await db.prepare('SELECT payload, fetched_at FROM news_archive WHERE cache_key = ?').bind(key).first()) as {payload:string;fetched_at:string} | null;
  if(previous){const data=JSON.parse(previous.payload) as Cached;const ttl=data.error?60000:86400000;
   if(Date.now()-Date.parse(previous.fetched_at)<ttl)return data;
  }
  const running=pending.get(key);if(running)return running;
  const job=(async()=>{
   let data:Cached;
   try{data={records:await collectMonth(kind,month)};}catch(e){data={records:previous?JSON.parse(previous.payload).records:archived?.records??[],error:e instanceof Error?e.message:'تعذر تحميل المصدر'};}
   await db.prepare('INSERT INTO news_archive (cache_key,payload,fetched_at) VALUES (?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').bind(key,JSON.stringify(data),new Date().toISOString()).run();
   return data;
  })();
  pending.set(key,job);try{return await job;}finally{pending.delete(key);}
}
