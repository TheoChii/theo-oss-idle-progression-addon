/* Pure, deterministic farming optimizer. Simulator results originate from addon-sim's
 * CharacterBot + ManiaGame worker. This module never mutates live game state. */
export const FARM_SKILLS=['accuracy','speed','stamina','jackspeed','coordination','release','reading','consistency','concentration','speedjam','memory'];
export const PHYSICAL=new Set(['speed','stamina','jackspeed']);
export const BLOCKED=new Set(FARM_SKILLS.filter(name=>!PHYSICAL.has(name)&&name!=='memory'));
const cb=(x0,y0,x1,y1)=>{let ax=1-(x1=3*(x1-x0)-(x0*=3))-x0,ay=1-(y1=3*(y1-y0)-(y0*=3))-y0;return t=>{if(t<=0)return 0;if(t>=1)return 1;let r=t,s=0,d=1,x;for(let i=0;i<32;i++){x=r*(r*(r*ax+x1)+x0)-t;if(Math.abs(x)<1e-5)break;const dv=r*(r*(r*ax*3+x1*2)+x0);if(Math.abs(dv)<1e-5)break;r-=x/dv;}if(r<0||r>1){r=t;for(let i=0;i<60;i++){x=r*(r*(r*ax+x1)+x0);if(Math.abs(x-t)<1e-5)break;if(t>x)s=r;else d=r;r=(d+s)/2;}}return r*(r*(r*ay+y1)+y0);};};
const CURVE=cb(.6,0,.6,1),FATIGUE_CURVE=cb(.4,0,.6,1);
export const mindblockKeep=n=>1-.75*CURVE(Math.min(1,Math.max(0,n)/25));
export const fatigueKeep=minutes=>1-.95*FATIGUE_CURVE(Math.min(1,Math.max(0,(minutes-300)/120)));
export const prestigeReady=(s)=>!!s&&Number(s.level)>=100+Math.max(0,Number(s.prestige)||0);
const playableSkills=states=>FARM_SKILLS.filter(skill=>!prestigeReady(states?.[skill]));
export const findTargets=(states,focus,backup,fatigueMinutes,cutoff=.1)=>{
 const available=playableSkills(states),physical=PHYSICAL.has(focus);
 const shouldSwap=physical&&fatigueKeep(fatigueMinutes)<=cutoff+1e-9;
 const primaryOk=focus==='all'||available.includes(focus);
 if(!primaryOk||shouldSwap){
  let names=backup==='all'?available:backup==='nonphysical'?available.filter(s=>!PHYSICAL.has(s)):available.filter(s=>s===backup);
  if(!names.length)return {skills:[],target:'none',reason:'No eligible fallback skill; prestige or choose another target.'};
  return {skills:names,target:backup,reason:!primaryOk?'Primary skill is prestige-ready; using fallback.':'Physical XP is below fatigue threshold; using fallback.'};
 }
 return {skills:focus==='all'?available:[focus],target:focus,reason:''};
};
const asCounts=v=>v instanceof Map?new Map(v):new Map(Object.entries(v||{}).map(([k,n])=>[Number(k),Number(n)||0]));
export function optimizeFarm(input){
 const {results=[],recent=new Map(),states={},focus='speed',backup='accuracy',fatigueMinutes=0,
   cutoff=.1,overheadSec=8,physicalShare=.4,slots=10,minEfficiency=.65,medals=1,mod='NM'}=input||{};
 const valid=results.filter(map=>map&&(map.mod||'NM')===mod&&Number.isSafeInteger(map.beatmapId)&&map.beatmapId>0&&Number(map.durationSec)>0
   &&Number.isFinite(Number(map.rate))&&map.failRate<=.5&&map.xp&&typeof map.xp==='object');
 const counts=asCounts(recent), rotation=[],used=new Set(),steps=Math.max(1,Math.min(100,Math.floor(slots)||10));
 let fatigue=Math.max(0,Math.min(420,Number(fatigueMinutes)||0));
 let lastTarget='',switched=false,explanations=[];
 if(!valid.length)return {mod,rotation,reason:'No successfully simulated playable maps.',fatigueAfter:fatigue,switched,expectedPerMinute:0};
 for(let i=0;i<steps;i++){
  const target=findTargets(states,focus,backup,fatigue,cutoff);
  if(!target.skills.length)return {mod,rotation,reason:target.reason||'All requested skills are prestige-ready.',fatigueAfter:fatigue,switched,expectedPerMinute:0};
  if(target.target!==focus)switched=true;
  if(target.reason&&!explanations.includes(target.reason))explanations.push(target.reason);
  lastTarget=target.target;
  const options=valid.map(map=>{
   const repetitions=counts.get(map.beatmapId)||0,keepMind=mindblockKeep(repetitions),keepPhysical=fatigueKeep(fatigue);
   const xp=target.skills.reduce((sum,skill)=>{
    const raw=Math.max(0,Number(map.xp[skill])||0);
    const blocked=BLOCKED.has(skill)?Math.floor(raw*keepMind):raw;
    const tired=PHYSICAL.has(skill)?Math.floor(blocked*keepPhysical):blocked;
    return sum+Math.floor(tired*medals);
   },0);
   const cost=map.durationSec+Math.max(0,overheadSec);
   return {...map,expectedXp:xp,xpPerMinute:cost>0?60*xp/cost:0,repeatBefore:repetitions,target:target.target,
    physicalKept:keepPhysical,mindblockKept:keepMind};
  }).filter(map=>map.expectedXp>0).sort((a,b)=>b.xpPerMinute-a.xpPerMinute);
  if(!options.length)break;
  const best=options[0].xpPerMinute;
  const threshold=best*Math.min(1,Math.max(0,minEfficiency));
  const candidate=options.find(map=>!used.has(map.beatmapId)&&map.xpPerMinute>=threshold);
  if(!candidate)break;
  rotation.push(candidate);used.add(candidate.beatmapId);
  counts.set(candidate.beatmapId,(counts.get(candidate.beatmapId)||0)+1);
  const share=Math.max(0,Math.min(1,Number(physicalShare)||0));
  const duration=candidate.durationSec/60;
  fatigue=Math.max(0,Math.min(420,fatigue+duration*share-.4*(duration*(1-share)+Math.max(0,overheadSec)/60)));
 }
 const totalXp=rotation.reduce((a,m)=>a+m.expectedXp,0);
 const totalSeconds=rotation.reduce((a,m)=>a+m.durationSec+Math.max(0,overheadSec),0);
 return {mod,rotation,reason:explanations.join(' '),fatigueAfter:fatigue,lastTarget,switched,
  expectedPerMinute:totalSeconds>0?60*totalXp/totalSeconds:0};
}
