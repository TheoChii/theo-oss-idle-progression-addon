/**
 * Live Farming safeguard while oss!idle server fatigue pacing is newer
 * than the last published shared simulator. Never use a rested or one-run
 * estimate to change the character's official autoplay queue.
 *
 * The pinned fatigue curve reaches maximum exhaustion at 420 strained minutes.
 * Running its most pessimistic state does not depend on how quickly the server
 * reaches exhaustion. Zero observed failures is NOT a mathematical guarantee.
 */
export const WORST_CASE_FATIGUE_MINUTES=420;
export const SAFETY_REFINEMENT_RUNS=16;
export function safeRefinedRows(rows,{fatigueMinutes,runs}={}){
 if(fatigueMinutes!==WORST_CASE_FATIGUE_MINUTES||!Number.isInteger(runs)||runs<SAFETY_REFINEMENT_RUNS)return [];
 return (rows||[]).filter(x=>x&&Number.isSafeInteger(x.beatmapId)&&x.beatmapId>0
  && Number.isFinite(x.rate)&&Number.isFinite(x.failRate)&&x.failRate===0
  && Number.isFinite(x.durationSec)&&x.durationSec>0&&['NM','HR'].includes(x.mod))
  .map(x=>({...x,isRefined:true}));
}
export const canPublishSafePlan=(plan,results)=>!!(plan?.rotation?.length
 &&Array.isArray(results)&&results.length>0&&plan.rotation.every(x=>
 x?.isRefined===true&&x.failRate===0));
