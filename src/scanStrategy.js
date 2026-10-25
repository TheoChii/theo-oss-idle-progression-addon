/** Pure plan helpers. Keep the first pass broad; reserve expensive three-run
 * simulations for promising, distinct maps, rather than every near-tie. */
export function activeModModes(preference){
 return preference==='NM'?['NM']:preference==='HR'?['HR']:['NM','HR'];
}
export function refineBudget(slots){
 const n=Number(slots);
 return Math.min(35,Math.max(8,Math.ceil(Number.isFinite(n)?n:10)*2));
}
/** A screening result is noisy (one bot run), so preserve at least the top
 * candidates and leave a 2% PP margin around existing bests. */
export function eligibleRefineRows(ranked,{goal='xp',bestPP=new Map(),ppRank='gainPerMinute',overheadSec=8,limit=20}={}){
 const selected=[];
 const first=ranked.find(x=>x.failRate<=.5&&Number(x.perSecond)>0&&Number(x.value)>0);
 const cutoff=goal==='pp'?0:(first?.perSecond??0)*.15;
 for(const row of ranked){
  if(!Number.isFinite(row.rate)||!Number.isFinite(row.beatmapId)||!Number.isFinite(row.durationSec))continue;
  if(row.failRate>.5||row.durationSec<=0)continue;
  if(goal==='pp'){
   const predicted=Number(row.pp)||0,old=Number(bestPP.get(row.beatmapId))||0;
   if(predicted<=0||predicted<old*.98)continue;
   const potential=Math.max(0,predicted-old)+Math.max(0,old*.02);
   selected.push({...row,refineScore:ppRank==='gain'?potential:potential/(row.durationSec+Math.max(0,overheadSec))});
  }else if(row.value>0&&row.perSecond>=cutoff){
   selected.push({...row,refineScore:row.perSecond});
  }
 }
 selected.sort((a,b)=>b.refineScore-a.refineScore);
 // Distinct difficulties rather than letting 15 playback rates of one map
 // monopolize refinement; refinePlan handles the neighboring rates.
 const seen=new Set();
 return selected.filter(row=>{
  if(seen.has(row.beatmapId))return false;
  seen.add(row.beatmapId);return seen.size<=limit;
 });
}
export function combineRefinementJobs(jobs){
 const merged=new Map();
 for(const job of jobs){
  if(!job?.rates?.length)continue;
  const old=merged.get(job.beatmapId);
  if(!old)merged.set(job.beatmapId,{...job,rates:[...new Set(job.rates)].sort((a,b)=>a-b)});
  else old.rates=[...new Set([...old.rates,...job.rates])].sort((a,b)=>a-b);
 }
 return [...merged.values()];
}
