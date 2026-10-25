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
export function filterRefineCandidates(ranked,{goal='xp',bestPP=new Map()}={}){
 const selected=[];
 const first=ranked.find(x=>x.failRate<=.5&&Number(x.perSecond)>0&&Number(x.value)>0);
 const cutoff=goal==='pp'?0:(first?.perSecond??0)*.15;
 for(const row of ranked){
  if(!Number.isFinite(row.rate)||!Number.isFinite(row.beatmapId)||!Number.isFinite(row.durationSec))continue;
  if(row.failRate>.5||row.durationSec<=0)continue;
  if(goal==='pp'){
   const predicted=Number(row.pp)||0,old=Number(bestPP.get(row.beatmapId))||0;
   if(predicted<=0||predicted<old*.98)continue;
   selected.push(row);
  }else if(row.value>0&&row.perSecond>=cutoff)selected.push(row);
 }
 return selected;
}
export function scoreRefineCandidate(row,{goal='xp',bestPP=new Map(),ppRank='gainPerMinute',overheadSec=8}={}){
 if(goal!=='pp')return Number(row.perSecond)||0;
 const old=Number(bestPP.get(row.beatmapId))||0,pp=Number(row.pp)||0;
 const potential=Math.max(0,pp-old)+Math.max(0,old*.02);
 return ppRank==='gain'?potential:potential/(row.durationSec+Math.max(0,overheadSec));
}
export function finishRefineCandidates(selected,limit=20){
 selected.sort((a,b)=>b.refineScore-a.refineScore);
 const seen=new Set(),out=[];
 for(const row of selected){
  if(seen.has(row.beatmapId))continue;
  seen.add(row.beatmapId);out.push(row);
  if(out.length>=limit)break;
 }
 return out;
}
export function eligibleRefineRows(ranked,opts={}){
 const selected=filterRefineCandidates(ranked,opts)
  .map(row=>({...row,refineScore:scoreRefineCandidate(row,opts)}));
 return finishRefineCandidates(selected,opts.limit??20);
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
