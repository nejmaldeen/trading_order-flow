export function crossedNews<T extends {id:string;time:number}>(events:T[],previous:number|null,cursor:number):T[]{
 if(previous===null||cursor<=previous)return [];
 return [...new Map(events.filter(e=>e.time>previous&&e.time<=cursor).map(e=>[e.id,e])).values()];
}
