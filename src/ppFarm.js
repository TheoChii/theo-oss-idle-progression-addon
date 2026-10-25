/* PP-only ranking. The game counts the best PP per beatmap, sorted with 0.95^rank.
 * Do not confuse high predicted PP with incremental weighted profile PP gain. */
export const PP_WEIGHT=.95;
const val=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
export const normalizeBestPP=data=>{
 const best=new Map();
 const iterable=data instanceof Map?data.entries():Array.isArray(data)?data.map(x=>[x.beatmapId,x.pp]):Object.entries(data||{});
 for(const [rawId,rawPP] of iterable){
  const id=Number(rawId),pp=val(rawPP);
  if(!Number.isSafeInteger(id)||id<=0||pp<=0)continue;
  best.set(id,Math.max(best.get(id)||0,pp));
 }
 return best;
};
export const weightedPP=best=>{
 const values=[...normalizeBestPP(best).values()].sort((a,b)=>b-a);
 let weight=1,sum=0;
 for(const pp of values){sum+=pp*weight;weight*=PP_WEIGHT;}
 return sum;
};
export function optimizePP(input={}){
 const {results=[],bestPP=new Map(),mod='NM',slots=10,overheadSec=8,scoreMode='gainPerMinute',minGain=.25,
  maxFailRate=.25}=input;
 const current=normalizeBestPP(bestPP),rotation=[];
 const valid=results.filter(x=>x&&(x.mod||'NM')===mod&&Number.isSafeInteger(x.beatmapId)&&x.beatmapId>0
  &&val(x.pp)>0&&Number(x.failRate)<=maxFailRate&&Number(x.durationSec)>0&&Number.isFinite(Number(x.rate)));
 const baseline=weightedPP(current),visited=new Set(),steps=Math.max(1,Math.min(50,Math.floor(slots)||10));
 const overhead=Math.max(0,Number(overheadSec)||0);
 let expected=baseline,totalSeconds=0;
 for(let i=0;i<steps;i++){
  let winner=null;
  for(const map of valid){
   if(visited.has(map.beatmapId))continue;
   const oldPP=current.get(map.beatmapId)||0,newPP=val(map.pp);
   if(newPP<=oldPP)continue;
   current.set(map.beatmapId,newPP);
   const newTotal=weightedPP(current);
   if(oldPP>0)current.set(map.beatmapId,oldPP);else current.delete(map.beatmapId);
   const delta=Math.max(0,newTotal-expected),duration=Number(map.durationSec)+overhead;
   if(delta<minGain||duration<=0)continue;
   const perMin=60*delta/duration;
   const rank=scoreMode==='gain'?delta:perMin;
   if(!winner||rank>winner.rank||(rank===winner.rank&&newPP>winner.map.pp))
    winner={map,rank,newTotal,delta,perMin,oldPP,duration};
  }
  if(!winner)break;
  const {map,newTotal,delta,perMin,oldPP,duration}=winner;
  rotation.push({...map,target:'PP',previousPP:oldPP,expectedPP:val(map.pp),
    ppGain:delta,ppGainPerMinute:perMin,expectedXp:0,xpPerMinute:0});
  visited.add(map.beatmapId);current.set(map.beatmapId,val(map.pp));expected=newTotal;totalSeconds+=duration;
 }
 const totalGain=Math.max(0,expected-baseline);
 return {mod,goal:'pp',rotation,currentPP:baseline,expectedPP:expected,expectedPPGain:totalGain,
   expectedPPGainPerMinute:totalSeconds?totalGain*60/totalSeconds:0,
   expectedPerMinute:0,fatigueAfter:0,reason:rotation.length?'':'No maps currently predict meaningful new weighted PP. Check the best-score history or rescan after upgrades.'};
}
