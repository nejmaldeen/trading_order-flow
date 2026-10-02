"use client";
import {useEffect,useRef,useState} from 'react';
import {GripVertical,Pause,Play,SkipForward,X,LocateFixed} from 'lucide-react';
type Props={playing:boolean;disabled:boolean;speed:number;time:string;onToggle:()=>void;onStep:()=>void;onSpeed:(n:number)=>void;onClose:()=>void;onLatest:()=>void};
export default function FloatingReplay(p:Props){
 const root=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null);
 const [pos,setPos]=useState({x:20,y:60});
 const constrain=(x:number,y:number)=>{const r=root.current,parent=r?.parentElement;return {x:Math.max(0,Math.min(x,(parent?.clientWidth??350)-(r?.offsetWidth??300))),y:Math.max(0,Math.min(y,(parent?.clientHeight??240)-(r?.offsetHeight??48)))};};
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('replay-floating-position')||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))setPos(constrain(saved.x,saved.y));}catch{}const parent=root.current?.parentElement;if(!parent)return;const observer=new ResizeObserver(()=>setPos(v=>constrain(v.x,v.y)));observer.observe(parent);return()=>observer.disconnect();},[]);
 const save=(next:{x:number;y:number})=>{setPos(next);try{localStorage.setItem('replay-floating-position',JSON.stringify(next));}catch{}};
 return <div ref={root} className="floating-replay" style={{left:pos.x,top:pos.y}} role="toolbar" aria-label="التحكم العائم بإعادة التشغيل" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
 <button className="floating-grip" title="اسحب لنقل الشريط · أو استخدم أسهم لوحة المفاتيح" aria-label="نقل شريط Replay" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:pos.x,top:pos.y};}} onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)setPos(constrain(d.left+e.clientX-d.x,d.top+e.clientY-d.y));}} onPointerUp={e=>{if(drag.current?.id!==e.pointerId)return;drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);save(pos);}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{const move:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};if(move[e.key]){e.preventDefault();const [x,y]=move[e.key];save(constrain(pos.x+x,pos.y+y));}}}><GripVertical size={18}/></button>
 <button onClick={p.onClose} title="إخفاء الشريط" aria-label="إخفاء شريط Replay"><X size={17}/></button>
 <span className="floating-divider"/>
 <button className={p.playing?'is-playing':''} disabled={!p.playing&&p.disabled} onClick={p.onToggle} title={p.playing?'إيقاف مؤقت':'تشغيل'} aria-label={p.playing?'إيقاف Replay العائم':'تشغيل Replay العائم'}>{p.playing?<Pause size={19}/>:<Play size={19}/>}</button>
 <button disabled={p.disabled} onClick={p.onStep} title="تقدم دقيقة واحدة" aria-label="تقدم دقيقة من الشريط العائم"><SkipForward size={19}/></button>
 <select value={p.speed} aria-label="سرعة Replay العائم" onChange={e=>p.onSpeed(Number(e.target.value))}>{[1,2,4,8,16,32,64].map(n=><option key={n} value={n}>{n}×</option>)}</select>
 <button onClick={p.onLatest} title="العودة إلى آخر شمعة" aria-label="آخر شمعة من الشريط العائم"><LocateFixed size={19}/></button>
 <time title="وقت المحاكاة الحالي">{p.time}</time>
 </div>;
}
