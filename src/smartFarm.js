import {gameCharacter, recentPlayCounts, gameDb} from '@oss-idle/addon-sdk';
import {collectCharts, runSweep, ratesFor, rankedDifficulties, medalMultiplier} from './engine/client.js';
import {rankMaps, screenRates, refinePlan, PLAYS_PER_MAP} from './farm/metrics.js';
import {FARM_SKILLS, optimizeFarm, prestigeReady, fatigueKeep} from './optimizer.js';
import {optimizePP} from './ppFarm.js';
import {readBestPP} from './ppHistory.js';
import {applyUpgrade} from '@oss-idle/shared/upgrades';
import {makePolicies,checkUpgrade,configExport,configImport,MAX_TIERS,MAX_OD} from './autoUpgradeRules.js';

const LABEL='Theo Smart Farm (managed)';
const SETTINGS='oss-idle-addon:theo-smart-farm-v1';
const UPGRADE_SETTINGS='oss-idle-addon:theo-auto-upgrade-policies-v1';
const API='https://api.oss.idle.rhythmgamers.net/v1';
const FOCUS=['all',...FARM_SKILLS];
const FALLBACK=['accuracy','nonphysical','all','stop',...FARM_SKILLS.filter(s=>s!=='accuracy')];
const defaults={goal:'xp',ppRank:'gainPerMinute',ppMinGain:0.25,focus:'speed',backup:'accuracy',fatigueMinutes:0,physicalShare:40,cutoff:10,overheadSec:8,slots:10,
 minEfficiency:65,scanInterval:20,modPreference:'auto',autoPlaylist:false,liveQueue:false};
const asNumber=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nice=(n,d=0)=>Number.isFinite(n)?Number(n).toLocaleString('en-US',{maximumFractionDigits:d}):'—';

export class SmartFarm {
 constructor(){
  this.s={...defaults};try{const old=JSON.parse(localStorage.getItem(SETTINGS)||'{}');for(const k of Object.keys(defaults)){if(Object.hasOwn(old,k)&&k!=='liveQueue'&&k!=='autoPlaylist')this.s[k]=old[k];}}catch{}
  this.scanning=false;this.live=false;this.sweep=null;this.results=[];this.recent=new Map();this.medals=1;this.ppHistory=null;this.lastPpFetch=0;
  this.character=null;this.plan=null;this.modPlans=null;this.root=null;this.shadow=null;this.visible=false;this.error='';this.message='';
  this.progress='Not scanned';this.scannedAt=0;this.lastCharacterId=null;this.appliedKey='';this.owner=false;
  this.socket=null;this.serverQueue=null;this.socketCharacterId=null;this.playActive=false;this.lastChange=0;this.previousMode=null;this.previousMods=null;
  this.tickInterval=null;this.keyHandler=null;this.consent=false;this.session=0;this.starting=false;
  this.pendingRescan=false;this.writing=false;this.profileFingerprint=null;
  // Policies persist locally; authenticated purchasing never arms on launch.
  let stored={};try{stored=JSON.parse(localStorage.getItem(UPGRADE_SETTINGS)||'{}');}catch{}
  this.upgradePolicies=makePolicies(FARM_SKILLS,stored);
  this.autoUpgrades=false;this.autoArmId=null;this.upgradeConsent=false;
  this.upgradeChecking=false;this.upgradePending=new Map();this.upgradeLog='';this.upgradeCursor=0;
  this.exportText='';this.importText='';
 }
 save(){
  try{const {liveQueue,autoPlaylist,...safe}=this.s;localStorage.setItem(SETTINGS,JSON.stringify(safe));}catch{}
 }
 saveUpgradePolicies(){
  try{localStorage.setItem(UPGRADE_SETTINGS,JSON.stringify(this.upgradePolicies));}catch{}
 }
 disarmUpgrades(reason='Auto-upgrades stopped.'){
  this.autoUpgrades=false;this.autoArmId=null;this.upgradeConsent=false;this.upgradePending.clear();
  this.upgradeLog=reason;
 }
 async upgradeRequest(path,options={}){
  const desktop=window.ossIdleDesktop?.isDesktop?window.ossIdleDesktop:null;
  const token=desktop?.getToken?.();
  if(desktop&&!token)throw Error('Sign into oss!idle desktop before using upgrades.');
  const response=await fetch(API+path,{
   ...options,credentials:desktop?'omit':'include',
   headers:{...(token?{Authorization:'Bearer '+token}:{}),...(options.headers||{})},
   signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(12000):undefined});
  if(!response.ok){
   const error=await response.json().catch(()=>({}));
   throw Error((error.message||error.error||'Request failed')+' (HTTP '+response.status+')');
  }
  return response.json();
 }
 async armUpgrades(){
  if(this.autoUpgrades||this.upgradeChecking)return;
  if(!this.upgradeConsent)throw Error('Confirm that auto-upgrades may spend skill levels.');
  if(!FARM_SKILLS.some(k=>this.upgradePolicies[k].enabled))throw Error('Enable at least one skill first.');
  await gameDb.ready();
  const local=await gameCharacter.live();
  if(!local||local.local||!(Number(local.id)>0))throw Error('Auto-upgrades require an online logged-in character.');
  const remote=await this.upgradeRequest('/me/character');
  if(!remote||Number(remote.id)!==Number(local.id))throw Error('Signed-in character and selected character do not match.');
  this.autoUpgrades=true;this.autoArmId=Number(local.id);
  this.upgradeConsent=false;this.upgradeLog='Armed for '+String(local.name||'character')+' (#'+local.id+'). Checking every minute; only enabled skills.';
  this.render();
  await this.checkAutoUpgrades();
 }
 async checkAutoUpgrades(){
  if(!this.autoUpgrades||this.upgradeChecking||!this.root)return;
  this.upgradeChecking=true;
  try{
   const local=await gameCharacter.live();
   if(!local||Number(local.id)!==this.autoArmId||local.local){
    this.disarmUpgrades('Selected character changed. Auto-upgrades disabled.');return;
   }
   const remote=await this.upgradeRequest('/me/character');
   if(!remote||Number(remote.id)!==this.autoArmId){
    this.disarmUpgrades('Signed-in character changed. Auto-upgrades disabled.');return;
   }
   const order=[...FARM_SKILLS.slice(this.upgradeCursor),...FARM_SKILLS.slice(0,this.upgradeCursor)];
   for(const skill of order){
    const rule=this.upgradePolicies[skill];
    if(!rule.enabled)continue;
    const current=remote.skills?.[skill];
    if(!current)throw Error('Missing official skill state for '+skill);
    const stage=Number(current.upgrades);
    const pending=this.upgradePending.get(skill);
    if(pending!==undefined){
     if(stage>pending)this.upgradePending.delete(skill);
     else continue; // Queued purchase still running; never request same tier twice.
    }
    if(remote.pendingActions?.some(a=>a.type==='upgrade'&&a.skill===skill))continue;
    const result=checkUpgrade(current,rule,applyUpgrade);
    if(!result.eligible)continue;
    // A single authenticated account-changing purchase per check, never a batch.
    const purchase=await this.upgradeRequest('/me/upgrade',{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skill})});
    // Both immediate success and a mid-play deferred purchase are guarded.
    this.upgradePending.set(skill,stage);
    this.upgradeCursor=(FARM_SKILLS.indexOf(skill)+1)%FARM_SKILLS.length;
    this.upgradeLog='Requested '+skill+' upgrade #'+(stage+1)+' (expected total OD '+result.preview.overdrive.toFixed(2)+
     ', target '+result.target+'). '+(purchase.queued?'Deferred until this play finishes.':'Server accepted.');
    this.pendingRescan=true;break;
   }
  }catch(e){
   this.disarmUpgrades('Auto-upgrades disabled after error: '+(e?.message||String(e)));
  }finally{
   this.upgradeChecking=false;this.render();
  }
 }
 mount(){
  if(this.root)return;
  const root=document.createElement('div');root.id='theo-smart-farm';root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:50001;font-family:system-ui';
  const shadow=root.attachShadow({mode:'open'});
  shadow.innerHTML='<style>'+this.css()+'</style><div class="scrim" id="farm-screen"><section class="panel"><header><h2>⚡ Smart Farm Planner</h2><button id="farm-close" aria-label="Close">✕</button></header><main id="farm-main"></main></section></div>';
  root.dataset.open='false';document.body.append(root);this.root=root;this.shadow=shadow;
  shadow.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;this.action(t.dataset.action||t.id);e.stopPropagation();});
  shadow.addEventListener('change',e=>{const t=e.target,k=t?.dataset?.setting;
   if(k){
    const previousGoal=this.s.goal;
    this.s[k]=t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value;
    this.save();
    if(k==='goal'&&previousGoal!==this.s.goal){
     if(this.live)this.stopLive(true);
     this.sweep?.cancel();this.session++;this.scanning=false;
     this.results=[];this.plan=null;this.modPlans=null;this.scannedAt=0;
     this.progress='Switched to '+(this.s.goal==='pp'?'PP':'XP')+' farming; preparing a fresh scan.';
     this.render();if(this.s.goal==='pp')void this.scan();
    }else{this.replan().catch(x=>this.fail(x));this.render();}
    e.stopPropagation();
   }
   if(t?.id==='farm-consent'){this.consent=t.checked;this.render();e.stopPropagation();}
   if(t?.id==='upgrade-consent'){this.upgradeConsent=Boolean(t.checked);this.render();e.stopPropagation();}
   const skill=t?.dataset?.autoSkill;
   if(skill&&Object.hasOwn(this.upgradePolicies,skill)){
    this.upgradePolicies[skill].enabled=Boolean(t.checked);
    this.saveUpgradePolicies();this.render();e.stopPropagation();
   }
   const targetSkill=t?.dataset?.autoTargetSkill;
   const tier=Number(t?.dataset?.autoTier);
   if(targetSkill&&Object.hasOwn(this.upgradePolicies,targetSkill)&&Number.isInteger(tier)&&tier>=0&&tier<MAX_TIERS){
    const v=Number(t.value);
    this.upgradePolicies[targetSkill].targets[tier]=Number.isFinite(v)?Math.max(0,Math.min(MAX_OD,v)):0;
    this.saveUpgradePolicies();e.stopPropagation();
   }
  });
  shadow.addEventListener('input',e=>{
   if(e.target?.id==='farm-import-json')this.importText=String(e.target.value).slice(0,100000);
   e.stopPropagation();
  });
  shadow.addEventListener('keydown',e=>e.stopPropagation());
  shadow.addEventListener('keyup',e=>e.stopPropagation());
  this.keyHandler=e=>{if(!e.repeat&&e.ctrlKey&&e.shiftKey&&!e.altKey&&!e.metaKey&&e.code==='KeyG'){e.preventDefault();e.stopImmediatePropagation();this.toggle();}else if(e.code==='Escape'&&this.visible){e.preventDefault();e.stopImmediatePropagation();this.toggle(false);}};
  window.addEventListener('keydown',this.keyHandler,true);
  this.tickInterval=setInterval(()=>void this.tick(),60000);
  this.render();
 }
 toggle(force){
  this.visible=force===undefined?!this.visible:force;
  if(this.root)this.root.dataset.open=String(this.visible);
  if(this.visible)this.render();
 }
 unmount(){
  this.session++;this.scanning=false;this.sweep?.cancel();this.sweep=null;
  this.disarmUpgrades('Add-on unloaded; auto-upgrades disarmed.');
  if(this.live)this.stopLive(true);
  if(this.tickInterval)clearInterval(this.tickInterval);
  if(this.keyHandler)window.removeEventListener('keydown',this.keyHandler,true);
  this.closeSocket();this.live=false;this.root?.remove();this.root=null;this.shadow=null;
 }
 fail(err){this.error=err?.message||String(err);this.render();}
 setProgress(v){this.progress=v;this.render();}
 async loadState(){
  await gameDb.ready();
  const c=await gameCharacter.live();
  if(!c)throw Error('No saved character detected. Play a map once, then try again.');
  const signature=FARM_SKILLS.map(k=>[Number(c[k+'Upgrades'])||0,Number(c[k+'Prestige'])||0]);
  const fingerprint=JSON.stringify(signature);
  if(c.id!==this.lastCharacterId){
   if(this.autoUpgrades)this.disarmUpgrades('Character switched; auto-upgrades stopped.');
   if(this.live){this.stopLive(false);this.message='Character changed; live queue updates suspended until you start again.';}this.results=[];this.plan=null;this.modPlans=null;this.lastCharacterId=c.id;this.appliedKey='';this.ppHistory=null;this.lastPpFetch=0;}
  else if(this.profileFingerprint!==null&&this.profileFingerprint!==fingerprint){this.pendingRescan=true;}
  this.profileFingerprint=fingerprint;
  this.character=c;
  const [recent,medals]=await Promise.all([recentPlayCounts(Number(c.id)),medalMultiplier(c)]);
  this.recent=recent;this.medals=medals??1;
  if(this.s.goal==='pp'){
   const updateServer=!c.local&&(!this.ppHistory||Date.now()-this.lastPpFetch>5*60000);
   const read=await readBestPP(c.id,{server:updateServer});
   if(!this.ppHistory||updateServer){this.ppHistory=read;this.lastPpFetch=Date.now();}
   else for(const [id,pp] of read.best)this.ppHistory.best.set(id,Math.max(pp,this.ppHistory.best.get(id)||0));
  }
 }
 async scan(){
  if(this.scanning)return;
  this.scanning=true;this.error='';const my=++this.session;
  this.setProgress('Reading character and downloaded maps…');
  try{
   await this.loadState();
   const c=this.character;
   const ranked=c.local?undefined:await rankedDifficulties();
   if(!c.local&&!ranked)throw Error('Ranked catalog unavailable; cannot safely select XP-paying maps.');
   const survey=await collectCharts(ranked);
   if(!survey.requests.length)throw Error('No downloaded ranked 4K difficulties found to simulate.');
   const rates=ratesFor(Number(c.speedUpgrades)||0,[]);
   const screened=screenRates(rates);
   const run=async(requests,runs,label)=>{
    this.setProgress(label+' · '+requests.length+' maps');
    const sweep=await runSweep(requests,{characterId:c.id,runs,memoryAhead:PLAYS_PER_MAP/2,fatigueMinutes:asNumber(this.s.fatigueMinutes,0,420,0),modModes:['NM','HR']},
      progress=>{if(my===this.session&&progress.done%5===0)this.setProgress(label+' '+progress.done+'/'+progress.total);});
    this.sweep=sweep;const answer=await sweep.finished;
    if(answer.cancelled||my!==this.session)throw Error('Scan cancelled.');
    return answer.results;
   };
   let results=await run(survey.requests.map(x=>({...x,rates:screened})),1,'Screening');
   const skillTargets=this.targetsToRefine();
   const jobs=new Map();
   for(const target of skillTargets){
    for(const mod of ['NM','HR']){
     const ranked=rankMaps(results.filter(x=>x.mod===mod),{target,overheadSec:this.s.overheadSec,recentPlays:this.recent,medalMultiplier:this.medals});
     for(const map of refinePlan(ranked,rates,screened,35))jobs.set(map.beatmapId,map);
    }
   }
   if(jobs.size){const refined=await run([...jobs.values()],3,'Refining');
    const keys=new Set(refined.map(x=>x.beatmapId+'@'+x.rate+'@'+x.mod));
    results=results.filter(x=>!keys.has(x.beatmapId+'@'+x.rate+'@'+x.mod)).concat(refined);
   }
   this.results=results;this.scannedAt=Date.now();this.pendingRescan=false;
   await this.replan();
   this.setProgress('Ready · '+new Set(results.map(x=>x.beatmapId)).size+' charts, '+results.length+' rate/mod simulations'+(this.s.goal==='pp'?' · PP bests: '+(this.ppHistory?.source||'not loaded'):''));
   if(this.live)await this.publish();
  }catch(e){if(my===this.session)this.fail(e);}
  finally{if(my===this.session){this.scanning=false;this.sweep=null;this.render();}}
 }
 targetsToRefine(){
  if(this.s.goal==='pp')return [{kind:'pp'}];
  const v=[this.s.focus==='all'?{kind:'total'}:{kind:'skill',skill:this.s.focus},
   this.s.backup==='all'||this.s.backup==='nonphysical'?{kind:'total'}:this.s.backup==='stop'?null:{kind:'skill',skill:this.s.backup}];
  return v.filter(Boolean);
 }
 async replan(){
  if(!this.results.length)return;
  const c=this.character;
  if(!c)return;
  const states=Object.fromEntries(FARM_SKILLS.map(k=>[k,{level:Number(c[k])||0,prestige:Number(c[k+'Prestige'])||0}]));
  const options={results:this.results,recent:this.recent,states,
   focus:this.s.focus,backup:this.s.backup,fatigueMinutes:asNumber(this.s.fatigueMinutes,0,420,0),
   cutoff:asNumber(this.s.cutoff,1,100,10)/100,physicalShare:asNumber(this.s.physicalShare,0,100,40)/100,
   overheadSec:asNumber(this.s.overheadSec,0,120,8),slots:asNumber(this.s.slots,1,50,10),
   minEfficiency:asNumber(this.s.minEfficiency,1,100,65)/100,medals:this.medals};
  if(this.s.goal==='pp'){
   const ppOpts={results:this.results,bestPP:this.ppHistory?.best||new Map(),
    slots:asNumber(this.s.slots,1,50,10),overheadSec:asNumber(this.s.overheadSec,0,120,8),
    minGain:asNumber(this.s.ppMinGain,0.01,100,0.25),
    scoreMode:this.s.ppRank==='gain'?'gain':'gainPerMinute'};
   this.modPlans={NM:optimizePP({...ppOpts,mod:'NM'}),HR:optimizePP({...ppOpts,mod:'HR'})};
  }else this.modPlans={NM:optimizeFarm({...options,mod:'NM'}),HR:optimizeFarm({...options,mod:'HR'})};
  const preference=this.s.modPreference;
  const metric=x=>this.s.goal==='pp'?this.s.ppRank==='gain'?x.expectedPPGain:x.expectedPPGainPerMinute:x.expectedPerMinute;
  this.plan=preference==='HR'?this.modPlans.HR:preference==='NM'?this.modPlans.NM:
   metric(this.modPlans.HR)>metric(this.modPlans.NM)?this.modPlans.HR:this.modPlans.NM;
  this.render();
 }
 async tick(){
  if(!this.root||(!this.live&&!this.autoUpgrades))return;
  if(this.autoUpgrades)await this.checkAutoUpgrades();
  if(!this.live||this.scanning)return;
  try{
   await this.loadState();
   await this.replan();
   // Scan full library at a bounded cadence; re-rank current results each minute.
   if(this.pendingRescan||Date.now()-this.scannedAt>=asNumber(this.s.scanInterval,10,120,20)*60000){await this.scan();return;}
   await this.publish();
  }catch(e){this.fail(e);}
 }
 async savePlaylist(){
  if(!this.plan?.rotation.length)throw Error('No maps to save; scan first.');
  await gameDb.ready();
  const rows=await gameDb.select('SELECT id FROM playlist WHERE name = ? ORDER BY id LIMIT 1',[LABEL]);
  let id=rows[0]?.id;
  if(!id){await gameDb.run('INSERT INTO playlist (name, createdAt) VALUES (?, ?)',[LABEL,Date.now()]);
   const updated=await gameDb.select('SELECT id FROM playlist WHERE name = ? ORDER BY id LIMIT 1',[LABEL]);
   id=updated[0]?.id;
  }
  if(!id)throw Error('Could not find the managed playlist.');
  // Only replace rows belonging to our named playlist, never a player's own lists.
  await gameDb.batch([{sql:'DELETE FROM playlist_entry WHERE playlistId = ?',params:[id]},
   ...this.plan.rotation.map((x,i)=>({sql:'INSERT INTO playlist_entry (playlistId, beatmapId, rate, position) VALUES (?, ?, ?, ?)',
     params:[id,x.beatmapId,x.rate,i+1]}))]);
  this.message='Updated managed playlist with '+this.plan.rotation.length+' maps. The playlist stores per-map rates, NOT mods: choose '+this.plan.mod+' manually in Song Select. Reopen Song Select to see it.';
  this.render();
 }
 socketUrl(){
  const t=window.ossIdleDesktop?.getToken?.();
  const url=new URL('https://api.oss.idle.rhythmgamers.net/v1/ws');
  url.protocol='wss:';url.searchParams.set('tz',Intl.DateTimeFormat().resolvedOptions().timeZone);
  if(t)url.searchParams.set('token',t);
  return url.toString();
 }
 async startLive(){
  if(this.live||this.starting)return;
  if(!this.consent)throw Error('Review the queue and check the confirmation first.');
  if(!this.plan?.rotation?.length)throw Error('Scan maps before starting the live queue.');
  if(this.character?.local)throw Error('Live server queue requires an online character.');
  this.starting=true;this.message='Connecting to official game queue…';this.render();
  const ws=new WebSocket(this.socketUrl());
  this.socket=ws;this.socketCharacterId=null;this.serverQueue=null;
  ws.onmessage=e=>{
   if(!this.root||this.socket!==ws)return;
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   if(msg.type==='character'){
    this.socketCharacterId=Number(msg.character?.id);
    if(this.socketCharacterId!==Number(this.character?.id)){this.fail(Error('Live character differs from selected character; queue disabled.'));this.stopLive(false);return;}
   }
   if(msg.type==='play:state')this.playActive=msg.state?.phase==='active';
   if(msg.type==='queue:state'){
    this.serverQueue=msg.state;
    if(this.live&&msg.state?.label!==LABEL){this.fail(Error('Queue was changed elsewhere. Automatic management paused.'));this.stopLive(false);}
   }
   if(this.starting&&this.socketCharacterId&&this.serverQueue){
    this.starting=false;this.live=true;this.previousMode=this.serverQueue?.prefs?.mode||null;this.previousMods=Array.isArray(this.serverQueue?.prefs?.mods)?[...this.serverQueue.prefs.mods]:null;void this.publish(true);
   }
  };
  ws.onclose=()=>{if(this.socket===ws){this.live=false;this.starting=false;this.socket=null;this.message='Live connection closed; automatic queue updates stopped.';this.render();}};
  ws.onerror=()=>{this.fail(Error('Could not connect to oss!idle live queue.'));ws.close();};
  setTimeout(()=>{if(this.starting&&this.socket===ws){this.fail(Error('No game queue state after 12 seconds.'));this.stopLive(false);}},12000);
 }
 closeSocket(){if(this.socket){const s=this.socket;this.socket=null;s.close();}}
 stopLive(clear=true){
  this.live=false;this.starting=false;this.consent=false;
  if(clear&&this.socket?.readyState===WebSocket.OPEN&&this.owner&&this.appliedKey&&
   (this.serverQueue?.label===LABEL||Date.now()-this.lastChange<3000)){
   this.socket.send(JSON.stringify({type:'queue:pause',paused:true}));
   this.socket.send(JSON.stringify({type:'queue:set',source:{label:LABEL},entries:[]}));
   const restore={};
   if(this.previousMode)restore.mode=this.previousMode;
   if(Array.isArray(this.previousMods))restore.mods=this.previousMods;
   if(Object.keys(restore).length)this.socket.send(JSON.stringify({type:'queue:prefs',prefs:restore}));
  }
  this.owner=false;this.closeSocket();this.render();
 }
 async publish(first=false){
  if(!this.live||!this.socket||this.socket.readyState!==WebSocket.OPEN||!this.plan)return;
  const ready=this.plan.rotation;
  // On a prestige threshold, end only the queue owned by this tool.
  if(!ready.length){this.message=this.s.goal==='pp'?'No simulated improvement remains in downloaded ranked maps; PP queue stopped.':'Selected targets are prestige-ready; managed queue stopped.';this.stopLive();return;}
  if(!first&&Date.now()-this.lastChange<45000)return;
  if(!first&&this.serverQueue?.label!==LABEL){this.stopLive(false);throw Error('Active queue belongs to another source; stopped.');}
  const entries=ready.map(x=>({beatmapId:x.beatmapId,rate:x.rate}));
  // Queue entries cannot carry mods individually: only ONE global mod setting can
  // apply to the entire rotation. Make the mod part of the update identity.
  const mod=this.plan.mod==='HR'?'HR':'NM';
  const key=JSON.stringify({entries,mod});
  const desiredMods=mod==='HR'?['HR']:[];
  if(!first&&this.serverQueue?.paused){this.message='Queue was paused in game; updates suspended.';this.render();return;}
  if(key===this.appliedKey){
   // Explicit live consent includes mod management even if a game UI changes mods.
   if(Array.isArray(this.serverQueue?.prefs?.mods)&&JSON.stringify(this.serverQueue.prefs.mods)!==JSON.stringify(desiredMods)){
    this.socket.send(JSON.stringify({type:'queue:prefs',prefs:{mods:desiredMods}}));
    this.message='Reapplied the planned '+mod+' global mod selection.';this.render();
   }
   return;
  }
  this.appliedKey=key;this.lastChange=Date.now();this.owner=true;
  this.socket.send(JSON.stringify({type:'queue:set',source:{label:LABEL,mode:'PLAYLIST'},entries}));
  if(first){
   // Explicit consent authorizes switching global mods for this managed session.
   this.socket.send(JSON.stringify({type:'queue:prefs',prefs:{mode:'PLAYLIST',mods:desiredMods}}));
  }else if(JSON.stringify(this.serverQueue?.prefs?.mods)!==JSON.stringify(desiredMods)){
   // New global mods take effect on NEXT play; we never abort an active map.
   this.socket.send(JSON.stringify({type:'queue:prefs',prefs:{mods:desiredMods}}));
  }
  // Replacing a queue clears its scheduled start on the official server.
  // Reschedule if idle; a currently active play schedules its own successor.
  if(!this.playActive)this.socket.send(JSON.stringify({type:'queue:start'}));
  this.message='Synced '+ready.length+' optimized maps; global mods '+mod+' (changes on next map).';
  this.render();
 }
 async action(cmd){
  try{
   if(cmd==='farm-close'){this.toggle(false);return;}
   if(cmd==='farm-scan'){await this.scan();return;}
   if(cmd==='farm-cancel'){this.session++;this.sweep?.cancel();this.scanning=false;this.setProgress('Scan cancelled');return;}
   if(cmd==='farm-save'){await this.savePlaylist();return;}
   if(cmd==='farm-start'){await this.startLive();return;}
   if(cmd==='farm-stop'){this.stopLive(true);this.message='Stopped auto queue. Only the managed queue was cleared.';this.render();return;}
   if(cmd==='upgrades-arm'){await this.armUpgrades();return;}
   if(cmd==='upgrades-disarm'){this.disarmUpgrades('Stopped by you. A purchase already queued by the server may still complete.');this.render();return;}
   if(cmd==='farm-settings-save'){this.save();this.saveUpgradePolicies();this.message='Settings saved locally on this device. Auto-upgrade purchasing is not enabled by saving.';this.render();return;}
   if(cmd==='farm-settings-export'){this.exportText=configExport(this.s,this.upgradePolicies,FARM_SKILLS);this.message='Backup generated. Copy the text below to keep or transfer your settings; no passwords or tokens are included.';this.render();return;}
   if(cmd==='farm-settings-import'){
    const next=configImport(this.importText,defaults,FARM_SKILLS);
    this.disarmUpgrades('Imported settings. Auto-purchasing remains OFF until you explicitly arm it.');
    if(this.live)this.stopLive(true);
    this.s=next.settings;this.upgradePolicies=next.upgrades;
    this.save();this.saveUpgradePolicies();
    this.exportText='';this.importText='';this.results=[];this.plan=null;this.modPlans=null;this.scannedAt=0;
    this.message='Imported and saved settings. Scan again for updated recommendations.';
    this.render();return;
   }
  }catch(e){this.fail(e);}
 }
 render(){
  if(!this.shadow)return;
  const el=this.shadow.getElementById('farm-main');if(!el)return;
  const option=(id,label,current)=>'<option value="'+esc(id)+'"'+(id===current?' selected':'')+'>'+esc(label)+'</option>';
  const field=(key,label,min,max,step)=>'<label>'+label+'<input type="number" min="'+min+'" max="'+max+'" step="'+step+'" data-setting="'+key+'" value="'+esc(this.s[key])+'"></label>';
  const select=(key,label,choices)=>'<label>'+label+'<select data-setting="'+key+'">'+choices.map(k=>option(k,k==='nonphysical'?'All non-physical':k==='stop'?'Stop if fatigued/ready':k==='all'?'All eligible skills':k,this.s[key])).join('')+'</select></label>';
  const p=this.plan;const ppMode=this.s.goal==='pp';
  const summary=p?(ppMode?'<div class="summary"><strong>+'+nice(p.expectedPPGain,2)+' weighted PP</strong><span>Projected gain across '+p.rotation.length+' new best(s)</span><strong>'+nice(p.expectedPPGainPerMinute,2)+' PP/min</strong><span>Estimated improvement rate</span></div>':
   '<div class="summary"><strong>'+nice(p.expectedPerMinute)+' XP/min</strong><span>Selected '+p.mod+' · duration-weighted XP/min</span><strong>'+nice(p.fatigueAfter,1)+' min</strong><span>Projected strain after rotation</span></div>'):'';
  const comparison=this.modPlans?(ppMode?'<p class="hint">No Mod: +'+nice(this.modPlans.NM.expectedPPGain,2)+' PP ('+nice(this.modPlans.NM.expectedPPGainPerMinute,2)+' PP/min) · HR: +'+nice(this.modPlans.HR.expectedPPGain,2)+' PP ('+nice(this.modPlans.HR.expectedPPGainPerMinute,2)+' PP/min). One global mod selection, separate song rates.</p>':
    '<p class="hint">No Mod: '+nice(this.modPlans.NM.expectedPerMinute)+' XP/min · Hard Rock: '+nice(this.modPlans.HR.expectedPerMinute)+' XP/min. Mod applies to the entire rotation; rates vary per song.</p>'):'';
  const html='<p class="intro">'+(ppMode?'PP Farm scans ranked downloaded 4K maps for <b>new personal-best PP</b>. Ranked total is weighted by 0.95 per rank; no repeated XP farming. It compares unlocked rates and NM/HR.':'Simulate downloaded ranked 4K maps at unlocked rates with <b>No Mod and Hard Rock</b> (HR has tighter windows and +10% Accuracy XP). Compare realistic XP per minute after Mindblock and fatigue.')+'</p>'+
   '<label>Farming goal<select data-setting="goal">'+[['xp','Skill XP / Prestige'],['pp','PP / Rank improvement']].map(([v,l])=>option(v,l,this.s.goal)).join('')+'</select></label>'+
   '<div class="group">'+(ppMode?'<label>PP priority<select data-setting="ppRank">'+[['gainPerMinute','Weighted PP gain / minute'],['gain','Highest weighted PP gain']].map(([v,l])=>option(v,l,this.s.ppRank)).join('')+'</select></label>'+field('ppMinGain','Minimum weighted PP improvement per map',0.01,100,0.25):select('focus','Primary XP skill',FOCUS)+select('backup','Switch to when physical XP ≤ threshold or prestige-ready',FALLBACK))+
   '<label>Mod strategy<select data-setting="modPreference">'+[['auto','Auto: best whole rotation'],['NM','No Mod only'],['HR','Hard Rock only']].map(([value,label])=>option(value,label,this.s.modPreference)).join('')+'</select></label>'+
   (!ppMode?field('cutoff','Physical XP cutoff (%)',1,100,1)+field('fatigueMinutes','Strained fatigue minutes (manual)',0,420,1)+field('physicalShare','Physical strain share (%)',0,100,5):field('fatigueMinutes','Strained fatigue minutes (manual)',0,420,1))+field('slots','Queue length',1,50,1)+
   field('overheadSec','Transition overhead (seconds)',0,120,1)+(!ppMode?field('minEfficiency','Minimum relative efficiency (%)',1,100,1):'')+
   field('scanInterval','Full rescan interval (minutes)',10,120,5)+'</div>'+
   '<div class="actions"><button id="farm-scan"'+(this.scanning?' disabled':'')+'>⚡ Scan downloaded maps</button><button id="farm-cancel"'+(!this.scanning?' disabled':'')+'>Cancel scan</button><button id="farm-save"'+(!p?.rotation?.length?' disabled':'')+'>Save managed playlist</button></div>'+
   '<p class="hint">'+esc(this.progress)+(this.scannedAt?' · Last scan '+new Date(this.scannedAt).toLocaleTimeString():'')+'</p>'+
   (p?summary+comparison+(ppMode?'<p class="hint">Existing PP source: '+esc(this.ppHistory?.source||'not available')+'. Projections are probabilistic and actual weighted PP depends on your server PBs; rescan after upgrades.</p>':'')+
     (p.reason?'<p class="notice">'+esc(p.reason)+'</p>':'')+
     '<div class="scroll"><table><thead><tr><th>#</th><th>Beatmap ID</th><th>Rate</th><th>Mod</th>'+(ppMode?'<th>Simulated PP</th><th>Previous best</th><th>Weighted gain</th>':'<th>Target</th><th>Est. XP/min</th><th>Fatigue</th>')+'</tr></thead><tbody>'+
     p.rotation.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+x.beatmapId+'</td><td>'+nice(x.rate,2)+'×</td><td>'+esc(x.mod||p.mod)+'</td>'+(ppMode?'<td>'+nice(x.expectedPP,2)+'</td><td>'+nice(x.previousPP,2)+'</td><td>+'+nice(x.ppGain,2)+'</td>':'<td>'+esc(x.target)+'</td><td>'+nice(x.xpPerMinute)+'</td><td>'+nice(x.physicalKept*100,1)+'%</td>')+'</tr>').join('')+'</tbody></table></div>':'<p class="hint">Scan once to calculate a rotation.</p>')+
   this.renderUpgradeSettings()+
   '<div class="danger"><h3>Live auto queue (explicit opt-in)</h3><p>Replaces the active server queue and its global mod selection with the optimized rotation. Can select NM/HR for the whole queue as fatigue changes, but cannot mix mods within a single queue (unlike per-map rates). It never interrupts a currently playing song. Only use on your logged-in character.</p><label class="consent"><input type="checkbox" id="farm-consent"'+(this.consent?' checked':'')+(this.live?' disabled':'')+'> Replace my current game queue, set session-wide mods (NM/HR), and set Autopilot to Playlist</label>'+
   '<div class="actions"><button id="farm-start"'+(!this.consent||!p?.rotation?.length||this.live||this.starting?' disabled':'')+'>▶ Start live optimizer</button><button id="farm-stop"'+(!this.live&&!this.starting?' disabled':'')+'>■ Stop and clear managed queue</button></div>'+
   '<p class="hint">Live updates use a second connection to the official game WebSocket. The game may have limits; this is experimental, and no live test has been performed. The add-on never skips the currently playing chart. Updates stop when disabled.</p></div>'+
   (this.error?'<p class="error">'+esc(this.error)+'</p>':'')+(this.message?'<p class="hint">'+esc(this.message)+'</p>':'')+
   '<p class="hint">PP mode uses your best ranked plays, not accumulated XP. Actual performance, failed plays, and server-side best scores may differ from simulation. No mod is saved with a local playlist. Previous global mods are restored on Stop only while connected.</p>';
  el.innerHTML=html;
 }
 renderUpgradeSettings(){
  const skills=FARM_SKILLS.map(skill=>{
   const policy=this.upgradePolicies[skill],current=this.character;
   const tierCount=Math.max(10,Math.min(MAX_TIERS,10+Math.max(0,Number(current?.[skill+'Prestige'])||0)));
   const stage=Number(current?.[skill+'Upgrades'])||0;
   const state=current?{level:current[skill],xp:current[skill+'XP'],upgrades:stage,
    overdrive:current[skill+'Overdrive'],prestige:current[skill+'Prestige']}:null;
   const outcome=state?checkUpgrade(state,{...policy,enabled:true},applyUpgrade):null;
   const currentText=state?' · gear '+stage+'/'+tierCount+' · raw OD '+nice(Number(state.overdrive)||0,2)+
    (outcome?.preview?' → '+nice(outcome.preview.overdrive,2)+' after next purchase':''):'';
   const targets=Array.from({length:tierCount},(_,i)=>
    '<label>#'+(i+1)+' <input type="number" min="0" max="'+MAX_OD+'" step="0.1" data-auto-target-skill="'+skill+
    '" data-auto-tier="'+i+'" value="'+esc(policy.targets[i])+'"></label>').join('');
   return '<div class="upgrade-skill"><label class="consent"><input type="checkbox" data-auto-skill="'+skill+
    '"'+(policy.enabled?' checked':'')+'><b>'+esc(skill)+(skill==='memory'?' (forgets plays)':'')+'</b></label><details><summary>Set target Overdrive for each numbered upgrade'+
    esc(currentText)+'</summary><p class="hint">0 = buy at minimum required level. A value above 0 waits until the projected TOTAL raw Overdrive after buying this tier meets your target.'+
    (skill==='memory'?' <b>Memory upgrades can forget earlier plays.</b>':'')+'</p><div class="od-tiers">'+targets+'</div></details></div>';
  }).join('');
  return '<section class="danger"><h3>⚙ Auto skill upgrades (OFF by default)</h3>'+
   '<p class="hint">Set the minimum <b>total raw Overdrive (σ) AFTER buying</b> upgrade #1, #2, and so on, independently for each skill. The planner uses the game\'s real overspend formula, including XP and level cost, and will wait until your target is met. These purchases permanently spend skill levels, and Memory upgrades may erase plays.</p>'+
   '<p class="hint">Settings are saved per device; switches below do not purchase anything until you arm auto-upgrades. Arm state is never saved, and it stops on character changes, errors or add-on unload.</p>'+
   '<div class="upgrade-grid">'+skills+'</div>'+
   '<label class="consent"><input type="checkbox" id="upgrade-consent"'+(this.upgradeConsent?' checked':'')+
   (this.autoUpgrades?' disabled':'')+'> I authorize automatic purchases of enabled skill upgrades, including their level costs.</label>'+
   '<div class="actions"><button id="upgrades-arm"'+(this.autoUpgrades||!this.upgradeConsent||this.upgradeChecking?' disabled':'')+
   '>▶ Arm auto-upgrades</button><button id="upgrades-disarm"'+(!this.autoUpgrades?' disabled':'')+'>■ Stop auto-upgrades</button></div>'+
   '<p class="hint">Status: '+(this.autoUpgrades?'ACTIVE for character #'+this.autoArmId:'OFF')+
   ' · at most one upgrade request per 60-second check. '+esc(this.upgradeLog)+'</p>'+
   '<details class="settings-backup"><summary>💾 Save / transfer Smart Farm settings</summary>'+
   '<p class="hint">Ordinary planner settings and per-skill targets save automatically to local storage. Backup text can be copied to another device; importing never enables live queue or auto-purchasing.</p>'+
   '<div class="actions"><button id="farm-settings-save">Save settings now</button><button id="farm-settings-export">Export settings backup</button></div>'+
   (this.exportText?'<label>Copy this backup JSON<textarea readonly rows="5">'+esc(this.exportText)+'</textarea></label>':'')+
   '<label>Paste saved settings JSON<textarea id="farm-import-json" rows="4" placeholder="Paste exported Smart Farm settings JSON here">'+esc(this.importText)+'</textarea></label>'+
   '<button id="farm-settings-import">Import saved settings</button></details></section>';
 }
 css(){return `:host{font-family:system-ui;color:#ecedf5}:host *{box-sizing:border-box}#farm-screen{display:none;pointer-events:auto;position:fixed;inset:0;background:#060b18ac;justify-content:center;align-items:center;padding:14px}:host([data-open="true"]) #farm-screen{display:flex}.panel{width:min(890px,98vw);max-height:91vh;overflow:auto;background:#181b2d;border:1px solid #586090;border-radius:14px;box-shadow:0 10px 55px #000b}header{position:sticky;top:0;background:#242941;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;z-index:2}h2,h3{margin:0;font-size:18px}main{padding:14px}button{background:#4d569b;color:#fff;border:1px solid #7782c1;border-radius:7px;padding:9px 12px;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}header button{background:#30374c}.intro,.hint{font-size:12px;color:#c1c7d9}.group{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px}label{font-size:11px;color:#c0c8e9}input,select{display:block;width:100%;padding:7px;background:#12182b;color:#f0effe;border:1px solid #566183;border-radius:6px;margin-top:3px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.summary{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:4px 10px;background:#262f40;padding:10px;border-radius:7px;margin-top:9px}.summary strong{color:#e4e8ff;font-size:19px}.summary span{font-size:11px;color:#9db5ca}.scroll{overflow:auto;max-height:250px;margin:10px 0}table{border-collapse:collapse;width:100%;font-size:11px}th,td{padding:8px;text-align:left;border-bottom:1px solid #374059}th{position:sticky;top:0;background:#2b324a}.danger{border-top:1px solid #636f92;margin-top:15px;padding-top:12px}.danger h3{font-size:14px}.upgrade-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}.upgrade-skill{padding:8px;border:1px solid #4e5b7b;border-radius:7px}.upgrade-skill summary{cursor:pointer;font-size:11px;padding:5px 0}.od-tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:5px}.od-tiers input{width:100%}.settings-backup{margin-top:12px;padding:8px;border:1px solid #4e5b7b;border-radius:7px}textarea{width:100%;background:#12182b;color:#eee;border:1px solid #566183;border-radius:6px;padding:9px}.consent{display:flex;align-items:center;gap:7px;font-size:12px}.consent input{width:auto}.notice{font-size:12px;color:#eed9a2}.error{font-size:12px;color:#ff909a}`;}
}
