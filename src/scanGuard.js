/** Bound each scanner initialization phase; never leave the UI waiting forever.
 * The network callback may honor the AbortSignal; local DB operations cannot
 * reliably be cancelled, so late results are ignored by the calling scan. */
export function withTimeout(label,timeoutMs,task){
 const controller=new AbortController();
 let timer;
 const work=Promise.resolve().then(()=>task(controller.signal));
 const timedOut=new Promise((_,reject)=>{
  timer=setTimeout(()=>{
   controller.abort();
   reject(new Error(label+' timed out after '+Math.ceil(timeoutMs/1000)+' seconds. Check the game database/network and retry.'));
  },timeoutMs);
 });
 return Promise.race([work,timedOut]).finally(()=>clearTimeout(timer));
}
