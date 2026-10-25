/** Scan-scoped read-only .osu text cache. Prevents repeated desktop IPC work
 * during Screening -> Refining without pinning the whole map library in RAM. */
export const DEFAULT_CACHE_BYTES=64*1024*1024;
export function createChartCache(maxBytes=DEFAULT_CACHE_BYTES){
 const items=new Map();let bytes=0,hits=0,misses=0;
 const limit=Math.max(0,Math.floor(maxBytes));
 const key=(set,id)=>set+'@'+id;
 return {
  get(set,id){
   const k=key(set,id);
   if(!items.has(k)){misses++;return undefined;}
   const item=items.get(k);items.delete(k);items.set(k,item);hits++;
   return item.text;
  },
  put(set,id,text){
   if(typeof text!=='string')return;
   const k=key(set,id),size=text.length*2;
   if(items.has(k)){bytes-=items.get(k).size;items.delete(k);}
   if(size>limit)return;
   items.set(k,{text,size});bytes+=size;
   while(bytes>limit&&items.size){
    const first=items.keys().next().value;
    bytes-=items.get(first).size;items.delete(first);
   }
  },
  clear(){items.clear();bytes=0;},
  get stats(){return {bytes,entries:items.size,hits,misses,limit};}
 };
}
/** Bound IPC concurrency. Worker pool controls mapsets while each desktop
 * folder is read with at most four file reads outstanding. */
export async function mapLimit(items,concurrency,work){
 const out=new Array(items.length);let offset=0;
 const worker=async()=>{while(offset<items.length){const i=offset++;out[i]=await work(items[i],i);}};
 await Promise.all(Array.from({length:Math.min(items.length,Math.max(1,Math.floor(concurrency)))},worker));
 return out;
}

/** One scan-wide desktop-IPC limiter shared by every worker slot. */
export function createLimiter(concurrency=4){
 const count=Math.max(1,Math.floor(concurrency));
 let active=0;const pending=[];
 const pump=()=>{
  while(active<count&&pending.length){
   const {task,resolve,reject}=pending.shift();active++;
   Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;pump();});
  }
 };
 const limit=task=>new Promise((resolve,reject)=>{pending.push({task,resolve,reject});pump();});
 limit.stats=()=>({active,pending:pending.length,limit:count});
 return limit;
}
