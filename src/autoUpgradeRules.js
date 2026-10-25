/* Pure policy data and planning for opt-in gear upgrades.
 * A target is the TOTAL raw Overdrive after buying numbered gear upgrade N.
 * The true ratio/spend comes from the game's pinned applyUpgrade model. */
export const DEFAULT_TIERS=10;
export const MAX_TIERS=30;
export const MAX_OD=1_000_000;
export const makePolicies=(skills,stored={})=>Object.fromEntries(skills.map(skill=>{
 const source=stored&&typeof stored==='object'&&Object.hasOwn(stored,skill)?stored[skill]:{};
 const enabled=source?.enabled===true;
 const targets=Array.from({length:MAX_TIERS},(_,i)=>{
  const v=Number(source?.targets?.[i]??0);
  return Number.isFinite(v)?Math.max(0,Math.min(MAX_OD,v)):0;
 });
 return [skill,{enabled,targets}];
}));
export function checkUpgrade(state,policy,applyUpgrade){
 if(!policy?.enabled)return {eligible:false,reason:'Skill auto-upgrade is off'};
 const level=Number(state?.level),xp=Number(state?.xp),upgrades=Number(state?.upgrades);
 const od=Number(state?.overdrive),prestige=Number(state?.prestige);
 if(![level,xp,upgrades,od,prestige].every(Number.isFinite)||!Number.isInteger(level)||!Number.isInteger(upgrades)||upgrades<0)
  return {eligible:false,reason:'Invalid current skill data'};
 if(upgrades>=Math.min(MAX_TIERS,10+Math.max(0,prestige)))
  return {eligible:false,reason:'No further gear tier available'};
 const target=Number(policy.targets?.[upgrades]??0);
 if(!Number.isFinite(target)||target<0||target>MAX_OD)return {eligible:false,reason:'Invalid target'};
 let preview;
 try{preview=applyUpgrade({level,xp,upgrades,overdrive:od,prestige});}
 catch{return {eligible:false,target,reason:'Next upgrade not yet purchasable'};}
 const eligible=preview.overdrive+1e-8>=target;
 return {eligible,target,preview,
  reason:eligible?'Ready to purchase':'Waiting for projected Overdrive '+target,
  gained:preview.overdrive-od};
}
export function configExport(settings,policies,skills){
 const safe={...settings};
 delete safe.autoPlaylist;delete safe.liveQueue;delete safe.autoUpgradeActive;
 return JSON.stringify({format:'Theo Smart Farm settings',version:1,settings:safe,
  upgrades:makePolicies(skills,policies)},null,2);
}
export function configImport(text,defaults,skills){
 const raw=JSON.parse(text);
 if(raw?.format!=='Theo Smart Farm settings'||raw?.version!==1||!raw.settings||typeof raw.settings!=='object')
  throw Error('Unsupported settings export.');
 const settings={...defaults};
 for(const [key,v] of Object.entries(raw.settings)){
  if(!Object.hasOwn(settings,key)||key==='autoPlaylist'||key==='liveQueue')continue;
  if(typeof v!==typeof defaults[key])continue;
  if(typeof v==='number'&&!Number.isFinite(v))continue;
  settings[key]=v;
 }
 return {settings,upgrades:makePolicies(skills,raw.upgrades)};
}
