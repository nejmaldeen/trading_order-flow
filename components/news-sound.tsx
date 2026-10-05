"use client";
import {useEffect,useRef,useState} from 'react';
import type {MacroSnapshot} from '@/lib/macro';
import {crossedNews} from '@/lib/news-alerts';
export default function NewsSound({data}:{data:MacroSnapshot|null}){
 const audio=useRef<AudioContext|null>(null),previous=useRef<number|null>(null);
 const [enabled,setEnabled]=useState(false),[message,setMessage]=useState('');
 const beep=()=>{const ctx=audio.current;if(!ctx||ctx.state!=='running')return;
  const oscillator=ctx.createOscillator(),gain=ctx.createGain();
  oscillator.connect(gain);gain.connect(ctx.destination);oscillator.frequency.value=740;
  gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.35);
  oscillator.start();oscillator.stop(ctx.currentTime+.36);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
 };
 useEffect(()=>{
  if(!data)return;
  if(previous.current!==null&&data.cursor<previous.current)setMessage('');
  const events=crossedNews(data.events.filter(e=>e.status==='released'),previous.current,data.cursor);
  previous.current=data.cursor;
  if(events.length){setMessage('صدر الآن: '+events.map(e=>e.title).join('، '));if(enabled)beep();}
 },[data,enabled]);
 useEffect(()=>()=>{void audio.current?.close();},[]);
 const toggle=async()=>{
  if(enabled){setEnabled(false);return;}
  try{if(!audio.current||audio.current.state==='closed')audio.current=new AudioContext();await audio.current.resume();
   if(audio.current.state!=='running')throw new Error();setEnabled(true);beep();
  }catch{setMessage('تعذر تشغيل الصوت؛ اضغط تفعيل الصوت مجددًا.');}
 };
 return <div className="news-sound"><button type="button" aria-pressed={enabled} onClick={()=>void toggle()}>{enabled?'🔔 صوت الأخبار مفعّل · كتم':'🔕 تفعيل صوت الأخبار'}</button>{message&&<span role="status">{message}</span>}</div>;
}
