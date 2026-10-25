/* Theo's oss!idle Progression Toolkit v0.5.6 — in-game add-on source.
   Press Ctrl+Shift+P to toggle the calculator, Esc to close it.
   Calculators read-only. Optional Friend Manager writes only after explicit approval. AGPL-3.0-only. */
const K='oss-idle-addon:theo-progression-toolkit-v1', A={level:90,upgrades:9,overdrive:15,prestige:1,buyAt:100.25,xpPlay:30000,overall:100.13,totalXpPlay:90000,minutes:4,hours:5,repeats:10,exempt:30000,physical:30000,memory:0,affected:10000,fatigueMinutes:0,restMinutes:0,strainShare:40,betweenMinutes:0.5,staminaUpgrades:0,warmMapMinutes:4,warmPhysicalShare:40,warmGapMinutes:0.5,improveCurrent:100,improveTarget:100.1,improvePrestige:0,improveSkill:'speed',bronze:0,silver:0,gold:0,platinum:0,divine:0};
let data={...A},root=null,tab='Improvement',section='Calculators',hotkeyHandler=null;
const val=k=>Math.max(0,+data[k]||0),fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
function cb(x0,y0,x1,y1){let ax=1-(x1=3*(x1-x0)-(x0*=3))-x0,ay=1-(y1=3*(y1-y0)-(y0*=3))-y0;return t=>{if(t<=0)return 0;if(t>=1)return 1;let r=t,s=0,d=1,x;for(let i=0;i<32;i++){x=r*(r*(r*ax+x1)+x0)-t;if(Math.abs(x)<1e-5)break;let dv=r*(r*ax*3+x1*2)+x0;if(Math.abs(dv)<1e-5)break;r-=x/dv;}if(r<0||r>1){r=t;for(let i=0;i<60;i++){x=r*(r*(r*ax+x1)+x0);if(Math.abs(x-t)<1e-5)break;if(t>x)s=r;else d=r;r=(d+s)/2;}}return r*(r*(r*ay+y1)+y0);};}
const early=cb(.1,.4,.95,0),late=cb(.5,0,1,.4),mind=cb(.6,0,.6,1);
const xp=n=>100+9900*early(n/100)+90000*late((n-60)/40)+(n<100?0:5e6*(n-99)*(n-98));
const xpTotal=[0];function to(n){n=Math.max(0,Math.floor(n));while(xpTotal.length<=n){let x=xpTotal.length-1;xpTotal.push(xpTotal[x]+xp(x));}return xpTotal[n];}
const xpAt=n=>to(Math.floor(n))+(n%1)*xp(Math.floor(n));
const realLevel=(level,partial)=>Math.max(0,Number(level)||0)+Math.min(.999999,Math.max(0,Number(partial)||0)/xp(Math.max(0,Number(level)||0)));
function levelFromTotal(total){const t=Math.max(0,Number(total)||0);let l=0;while(l<10000&&to(l+1)<=t)l++;return l+Math.min(.999999,(t-to(l))/xp(l));}
const sigma=n=>Math.max(1,Math.min(n,2.5*Math.pow(n,Math.log10(2))));
/** Medal bonuses compound per owned medal, in a separate XP multiplier pool. */
const MEDAL_RATES={bronze:.0025,silver:.005,gold:.01,platinum:.02,divine:.03};
/* Medal IDs/tier groups mirrored from official achievements/catalogue.ts, 2026-10-24 (148 medal IDs).
 * Unknown future IDs are ignored, and reported rather than misclassified. */
const MEDAL_IDS_BY_TIER={
 bronze: ["plays-100","hits-100k","time-10h","overall-25","upgrades-1","top-75","play-pp-50","play-pp-100","curator-1","pass-1","pass-2","fc-1","fc-2","friends-1","mapper-1","mapper-2"],
 silver: ["grade-ss","plays-1k","hits-1m","time-100h","overall-50","upgrades-10","ladders-1","overdrive-2","prestige-1","first-1","pp-1k","top-50","play-pp-200","curator-5","combo-727","same-map-100","fail-99","night-owl","first-chat","possessed","pass-3","pass-4","fc-3","fc-4","speed-50","stamina-50","jackspeed-50","accuracy-50","reading-50","release-50","coordination-50","consistency-50","concentration-50","speedjam-50","memory-50","friends-5","mapper-5","fail-10s","parallax"],
 gold: ["grade-x","rice","ln","plays-5k","hits-10m","time-1000h","overall-75","overall-100","upgrades-50","ladders-5","overdrive-10","prestige-5","first-10","pp-5k","top-25","play-pp-500","curator-25","pass-5","pass-6","fc-5","fc-6","speed-100","stamina-100","jackspeed-100","accuracy-100","reading-100","release-100","coordination-100","consistency-100","concentration-100","speedjam-100","memory-100","friends-25","mapper-10"],
 platinum: ["plays-25k","hits-50m","time-10000h","overall-105","upgrades-100","ladders-10","overdrive-100","prestige-25","first-100","pp-10k","top-10","play-pp-750","curator-100","pass-7","pass-8","fc-7","fc-8","speed-105","stamina-105","jackspeed-105","accuracy-105","reading-105","release-105","coordination-105","consistency-105","concentration-105","speedjam-105","memory-105","friends-100","mapper-50"],
 divine: ["grade-xx","plays-100k","hits-1b","overall-110","ladders-11","overdrive-1000","prestige-100","rebirth","first-1000","pp-20k","top-1","play-pp-1k","pass-9","pass-10","fc-9","fc-10","speed-110","stamina-110","jackspeed-110","accuracy-110","reading-110","release-110","coordination-110","consistency-110","concentration-110","speedjam-110","memory-110","friends-1k","mapper-100"],
};
const MEDAL_TIER_BY_ID=new Map(Object.entries(MEDAL_IDS_BY_TIER).flatMap(([tier,ids])=>ids.map(id=>[id,tier])));
const medalCountsFromIds=ids=>{
 const counts=Object.fromEntries(Object.keys(MEDAL_RATES).map(tier=>[tier,0]));let unknown=0;
 for(const id of new Set(ids)){const tier=MEDAL_TIER_BY_ID.get(id);if(tier)counts[tier]++;else unknown++;}
 return {counts,unknown};
};
/** Public, read-only medal list belonging to the chosen character; no login credentials. */
async function fetchPlayerMedals(id){
 if(!Number.isSafeInteger(id)||id<=0)throw Error('Online character ID needed for medal lookup.');
 const base='https://api.oss.idle.rhythmgamers.net';
 const response=await fetch(base+'/v1/characters/'+id+'/medals',{
  method:'GET',credentials:'omit',signal:typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(8000):undefined
 });
 if(!response.ok)throw Error('Medal service returned HTTP '+response.status);
 const responseData=await response.json();
 if(!responseData||!Array.isArray(responseData.held)||!responseData.held.every(x=>x&&typeof x.id==='string'))throw Error('Unexpected medal response format.');
 return medalCountsFromIds(responseData.held.map(x=>x.id));
}
const medals=counts=>Object.entries(MEDAL_RATES).reduce((product,[tier,rate])=>product*Math.pow(1+rate,Math.max(0,Math.floor(+counts[tier]||0))),1);
const boost=(u,s,p,m=1)=>(1+.1*u*sigma(s))*Math.pow(1.1,p)*m;
const minLevel=u=>u<10?(u+1)*10:u+91;
const levelCost=u=>u<10?10:1;
function preview(n,u,s,p,m=1){if(u>=10+p||n<minLevel(u))return null;let k=levelCost(u),l=Math.floor(n),r=n-l,cost=to(l)+r*xp(l)-to(l-k)-r*xp(l-k),base=to(minLevel(u))-to(minLevel(u)-k),ratio=cost/base,add=ratio>1?ratio:0;return {add,cost,newSigma:s+add,newBoost:boost(u+1,s+add,p,m),after:n-k};}
/* Skill Improvement core — mirrored from oss-idle/oss-idle packages/shared/src/sim/skills, 2026-10-21.
 * Inputs to skillMetrics are the mapped gameplay/strain level, NOT the visible XP level.
 * These formulas are embedded directly in the in-game add-on.
 * No network imports are required by the game's Blob-URL runtime. */
const SKILL_IDS=['speed','stamina','jackspeed','accuracy','reading','release','coordination','consistency','concentration','speedjam','memory'];
const SKILL_LABELS={speed:'Speed',stamina:'Stamina',jackspeed:'Jack Speed',accuracy:'Accuracy',reading:'Reading',release:'Release',coordination:'Coordination',consistency:'Consistency',concentration:'Concentration',speedjam:'Speed Jam',memory:'Memory'};
const unit01=n=>Math.max(0,Math.min(1,n));
const norm=(n,a,b)=>unit01((n-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;
const smoothNorm=(n,a,b)=>cb(.3125,.1875,.6875,.8125)(norm(n,a,b));
/** Mirrors levelCurve.ts breakpoints [0,0] [90,90] [110,100] [200,120] with extrapolated last slope. */
const gameplayLevel=effective=>effective<=90?Math.max(0,effective):effective<=110?90+(effective-90)/2:100+(effective-110)*(20/90);
const skillMetric=(label,value,unit='',better='up')=>({label,value,unit,better});
/** Source-equivalent live parameters, not a map simulation or a universal "% skill". */
function skillMetrics(id,l){
 const c=(x0,y0,x1,y1,t)=>cb(x0,y0,x1,y1)(t);
 switch(id){
  case 'speed': {
   const f=c(0,.65,1,.45,Math.min(1,l/100)),bonus=Math.min(100,Math.max(0,l-100));
   return [skillMetric('Sustained NPS',3+29*f+bonus*4,' NPS'),skillMetric('Comfort NPS',4+11*f+bonus*2,' NPS'),skillMetric('Enabled NPS',2+5*f+bonus*2,' NPS')];
  }
  case 'stamina':{
   const progress=c(.44,.66,.9,.4,Math.min(1,l/100)),bonus=c(.44,.66,.9,.4,norm(l,100,200));
   return [skillMetric('Stamina NPS threshold',1.2+6.6*progress+0.6*Math.min(100,Math.max(0,l-100)),' NPS'),
    skillMetric('Recovery rate',.025+.015*progress+.015*bonus,'/s'),
    skillMetric('Fatigue rate',Math.max(.001,(.030-.015*progress)*(1-.6*bonus)),'/s','down')];
  }
  case 'jackspeed':{
   const cjs=t=>c(.83,.63,.9,.71,t);
   const base=cjs(smoothNorm(l,0,100)),normal=cjs(smoothNorm(l,0,50)),late=cjs(smoothNorm(l,70,100)),verylate=cjs(smoothNorm(l,90,100)),bonus=cjs(smoothNorm(l,100,200));
   const comfort=2+2*base+.5*normal+.65*late+1.75*verylate+8*bonus,nps=comfort+1+2*base;
   return [skillMetric('Clean presses/hand',nps,'/s'),skillMetric('Comfort presses/hand',comfort,'/s'),skillMetric('Maximum presses/hand',nps+1+2*base,'/s')];
  }
  case 'accuracy':{
   const bad=c(1,.3,.9,.5,1-norm(l,0,100)/2-norm(l,100,200)/2);
   return [skillMetric('Timing error strain',bad,'','down'),
    skillMetric('Minimum error scale',6*bad*Math.max(1,6*bad),' ms','down'),
    skillMetric('Maximum error scale',12*bad*Math.max(1,12*bad),' ms','down')];
  }
  case 'reading':{
   const f=t=>c(.22,1,.8,.6,t),skill=7*f(l/100)+4*f(Math.max(0,l-100)/10),bonus=norm(l,90,100);
   return [skillMetric('Readable notes threshold',2+skill+bonus,' notes'),skillMetric('Transition threshold',4+skill+2*bonus,' transitions')];
  }
  case 'release':{
   const f=t=>c(0,.65,1,.45,t),base=t=>c(.5,1,.95,.8,t),effective=l-base(Math.min(1,l/100))*7;
   const b=base(Math.max(0,1-effective/120)),b2=base(Math.max(0,1-effective/150));
   return [skillMetric('LN base imprecision',b*(.10+.02*b2),'','down'),
    skillMetric('LN recovery rate',Math.max(.0001,.005*f(norm(effective,0,100))+.005*f(Math.max(0,(effective-100)/100))),'/s'),
    skillMetric('LN fatigue rate',.0008*(1-f(norm(effective,100,200))),'/s','down'),
    skillMetric('LN precision factor',effective/120,'')];
  }
  case 'coordination':{
   const f=t=>c(.15,1,1,.86,t),p=f(Math.min(1,l/100)),bonus=f(norm(l,100,200));
   return [skillMetric('LN overlap strain gain',mix(mix(.33,.03,p),.015,bonus),'','down'),
    skillMetric('LN strain decay',mix(mix(.16,1.1,p),1.6,bonus),'/s')];
  }
  case 'consistency':{
   const f=t=>c(.67,.28,0,.75,t),miss=t=>c(1,.58,1,.89,t);
   const chance=.0015-f(l/110)*(.0015-.00005)-f(norm(l,110,200))*(.00005-.00001);
   const fmiss=miss(l/110);
   return [skillMetric('Choke probability per input',chance*100,'%','down'),
    skillMetric('Miss share at low pressure',mix(.01,.001,fmiss)*100,'%','down'),
    skillMetric('Miss share at high pressure',mix(.1,.01,fmiss)*100,'%','down')];
  }
  case 'concentration':{
   const wob=t=>c(.3,.85,.5,1,t),drift=t=>c(.3,.4,.6,.8,t),hold=t=>c(.4,.3,.6,.7,t);
   const steadiness=.7*wob(Math.min(1,l/100))+.3*wob(Math.max(0,(l-100)/100));
   return [skillMetric('Focus wobble intensity',Math.max(0,1-steadiness),'','down'),
    skillMetric('Timing drift intensity',Math.max(0,1-drift(Math.min(1,l/100))),'','down'),
    skillMetric('Focus hold before drift', (25000+140000*hold(Math.min(1,l/100)))/1000,' sec'),
    skillMetric('Wobble period',Math.max(1,l)*.4,' sec')];
  }
  case 'speedjam':{
   const f=t=>c(.3,1,.8,.7,t),p=f(Math.min(1,l/100));
   return [skillMetric('SV jam error factor',.3-(.25*p+.05*f(norm(l,100,200))),'','down'),
    skillMetric('Jam strain decay',mix(.16,1.1,p),'/s')];
  }
  case 'memory':{
   const f=t=>c(.22,1,.87,.78,t),improve=t=>c(.58,.17,.35,.87,t),boost=t=>c(.77,.77,.35,.9,t);
   const p=f(Math.min(1,l/100)),i=improve(Math.min(1,l/100)),bonus=f(norm(l,100,200));
   let maxPlays=mix(60,18,p),maxImprove=mix(mix(.1,.2,i),mix(.5,.95,i),p);
   maxPlays=mix(maxPlays,8,bonus);
   maxImprove=mix(maxImprove,.98,bonus);
   return [skillMetric('Max SV error reduced',maxImprove*100,'%'),
    skillMetric('Plays to maximum memory',maxPlays,' plays','down'),
    skillMetric('Plays to start memory',mix(2,1,p),' plays','down'),
    skillMetric('Learning-rate boost',mix(1,1.8,boost(p)),'×')];
  }
  default:throw new Error('Unknown skill: '+id);
 }
}

/* Map Discovery: read-only access to oss!idle's supported game bridges.
 * Based on oss-idle/addon-sdk bridge/db.ts, bridge/character.ts, bridge/beatmaps.ts.
 * Never update the game DB, game indexes or IndexedDB version. */
const mapState={status:'idle',error:'',sets:[],characters:[],characterId:null,suggestedId:null,
  played:new Map(),query:'',sort:'stars',limit:'all',unplayed:true};
let mapRequest=0;
const safeText=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const resultRows=res=>{const x=res?.[0];return x?x.values.map(row=>Object.fromEntries(x.columns.map((k,i)=>[k,row[i]]))):[]};
const gameRead=(sql,params=[])=>{
  if(!window.db?.read)throw new Error('Game score database is not ready. Open Song Select, then refresh.');
  return window.db.read(db=>resultRows(db.exec(sql,params)));
};
function readDownloadedSets(){
  if(typeof indexedDB==='undefined')return Promise.reject(new Error('Beatmap storage is not available.'));
  return new Promise((resolve,reject)=>{
    // As in the official SDK, omit the version to avoid upgrading the game's library.
    const req=indexedDB.open('beatmaps');
    req.onerror=()=>reject(req.error||new Error('Cannot open downloaded beatmaps.'));
    req.onblocked=()=>reject(new Error('Beatmap library is blocked by another game window.'));
    req.onsuccess=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('meta')){db.close();reject(new Error('No downloaded beatmap metadata available.'));return;}
      try{
        const tx=db.transaction('meta','readonly'),get=tx.objectStore('meta').getAll();
        get.onsuccess=()=>resolve((get.result||[]).filter(s=>s&&Array.isArray(s.versions)));
        get.onerror=()=>reject(get.error||new Error('Cannot read downloaded maps.'));
        tx.oncomplete=()=>db.close();
        tx.onerror=()=>{db.close();reject(tx.error||new Error('Cannot read downloaded maps.'));};
        tx.onabort=()=>db.close();
      }catch(e){db.close();reject(e);}
    };
  });
}
async function loadMapDiscovery(){
 const id=++mapRequest;
 mapState.status='loading';mapState.error='';renderDiscovery();
 try{
  const [sets,characters,latest]=await Promise.all([
    readDownloadedSets(),
    gameRead('SELECT id, name, local, current, overallTotalXp FROM character ORDER BY local ASC, current DESC, overallTotalXp DESC'),
    gameRead('SELECT characterId FROM score ORDER BY playedAt DESC LIMIT 1')
  ]);
  if(!root||id!==mapRequest)return;
  const suggested=characters.find(c=>Number(c.id)===Number(latest[0]?.characterId))
    ||characters.find(c=>Number(c.local)===0)||characters.find(c=>Number(c.current)===1)||characters[0];
  const picked=characters.find(c=>Number(c.id)===Number(mapState.characterId))||suggested;
  if(!picked)throw new Error('No character was found in your local game database.');
  const played=await gameRead('SELECT beatmapId, COUNT(*) AS plays FROM score WHERE characterId = ? GROUP BY beatmapId',[Number(picked.id)]);
  if(!root||id!==mapRequest)return;
  mapState.sets=sets;mapState.characters=characters;mapState.characterId=Number(picked.id);
  mapState.suggestedId=Number(suggested?.id);
  mapState.played=new Map(played.map(x=>[Number(x.beatmapId),Number(x.plays)]));
  mapState.status='ready';
 }catch(e){
  if(!root||id!==mapRequest)return;
  mapState.status='error';mapState.error=e?.message||String(e);
 }
 renderDiscovery();
}
const mapSelect=(key,values,selected)=>'<label>'+key+'<select data-map-filter="'+values.name+'">'+values.items.map(([v,desc])=>'<option value="'+safeText(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+safeText(desc)+'</option>').join('')+'</select></label>';
const mapMatches=()=>mapState.sets.flatMap(set=>set.versions.map(v=>({
  setId:Number(set.id),id:Number(v.id),title:String(set.title||'Unknown title'),
  artist:String(set.artist||'Unknown artist'),difficulty:String(v.version||'Unnamed'),
  stars:Number(v.difficulty),keys:Number(v.keys),objects:Number(v.objects),
  mode:Number(v.mode),plays:mapState.played.get(Number(v.id))||0
}))).filter(x=>x.mode===3&&Number.isInteger(x.id)&&x.id>0&&Number.isFinite(x.stars)&&x.stars>=0&&Number.isFinite(x.objects)&&x.keys===4)
  .filter(x=>(!mapState.unplayed||!x.plays)
    &&(mapState.limit==='all'||x.stars<=Number(mapState.limit))
    &&(!mapState.query||(x.title+' '+x.artist+' '+x.difficulty+' '+x.id).toLowerCase().includes(mapState.query.toLowerCase())))
  .sort((a,b)=>mapState.sort==='notes'?a.objects-b.objects||a.stars-b.stars:
    mapState.sort==='title'?a.title.localeCompare(b.title)||a.stars-b.stars:
    mapState.sort==='hardest'?b.stars-a.stars:a.stars-b.stars||a.title.localeCompare(b.title));
function renderMapResults(){
 const target=root?.shadowRoot.querySelector('#map-results');
 if(!target||mapState.status!=='ready')return;
 const found=mapMatches(),visible=found.slice(0,80);
 const uniqueAll=mapState.sets.flatMap(x=>x.versions||[]).filter(x=>Number(x.mode)===3&&Number(x.keys)===4).length;
 target.innerHTML=grid([
  row('Downloaded 4K mania charts',fmt(uniqueAll,0),'Stored in this browser'),
  row(mapState.unplayed?'No local play found':'Matching charts',fmt(found.length,0),'For selected character and filters')
 ])+(found.length?tbl(['Map / Difficulty','Stars','Keys','Notes','Local plays','Link'],visible.map(x=>[
  '<b>'+safeText(x.title)+'</b><small>'+safeText(x.artist)+' • '+safeText(x.difficulty)+'</small>',
  fmt(x.stars,2)+'★',x.keys+'K',fmt(x.objects,0),fmt(x.plays,0),
  '<a class="map-link" href="https://osu.ppy.sh/beatmaps/'+x.id+'" target="_blank" rel="noopener noreferrer">View ↗</a>'
 ])):'<p>No downloaded maps matched these filters. Try a higher star limit or disable the unplayed filter.</p>')
 +(found.length>visible.length?'<p class="fine">Showing first '+visible.length+' of '+found.length+' matches. Refine the search to see more.</p>':'');
}
function renderDiscovery(){
 if(!root||section!=='Discovery')return;
 let c='<p>Explore downloaded <b>4K osu!mania</b> charts and find maps without a score in your <b>local play history</b>. This is a read-only lookup, not the live ranked catalog.</p>';
 if(mapState.status==='loading')c+='<p>Reading local beatmaps and scores…</p>';
 else if(mapState.status==='error')c+='<p class="notice">'+safeText(mapState.error)+'</p>';
 else if(mapState.status==='idle')c+='<p>Select Refresh to load your downloaded maps.</p>';
 if(mapState.status==='ready'){
  const char=mapState.characters.find(x=>Number(x.id)===mapState.characterId);
  c+=grid([
   mapSelect('Character',{name:'character',items:mapState.characters.map(x=>[x.id,x.name+' ('+(Number(x.local)?'local':'account')+')'])},mapState.characterId),
   mapSelect('Max stars',{name:'limit',items:[['all','All difficulties'],['2','Up to 2★'],['3','Up to 3★'],['4','Up to 4★'],['5','Up to 5★'],['6','Up to 6★']]},mapState.limit),
   mapSelect('Sort by',{name:'sort',items:[['stars','Easiest first'],['hardest','Hardest first'],['notes','Fewest notes'],['title','Title A–Z']]},mapState.sort)
  ]);
  c+='<label>Find song, artist, difficulty or map ID<input data-map-filter="query" type="search" placeholder="Search downloaded maps…" value="'+safeText(mapState.query)+'"></label>';
  c+='<label class="checkline"><input type="checkbox" data-map-filter="unplayed"'+(mapState.unplayed?' checked':'')+'> Only charts with no local play found</label>';
  c+='<p class="fine">Checking <b>'+safeText(char?.name||'unknown')+'</b>. This character is '+(mapState.characterId===mapState.suggestedId?'suggested from the latest stored score (or account/guest fallback)':'selected by you')+'. Local score history can be incomplete after reinstalling, clearing data, or switching devices. An unplayed result is not a guarantee of never playing it online. Ranked status is not verified live.</p>';
  c+='<div id="map-results"></div>';
 }
 c+='<p><button class="action-button" data-action="refresh-maps">'+(mapState.status==='loading'?'Loading…':'↻ Refresh downloaded maps and scores')+'</button></p>';
 root.shadowRoot.querySelector('#contents').innerHTML=c;
 renderMapResults();
}

/** From oss-idle/shared/fatigue.ts (1.2.2): strain minutes and XP penalty.
 * Fatigue starts at 300, reaches its XP floor at 420; no direct warm-up XP penalty. */
const FATIGUE_REST_RATE=.4,FATIGUE_CAP=420,FATIGUE_START=300,FATIGUE_FULL=420;
const fatigueLevel=minutes=>cb(.4,0,.6,1)(Math.max(0,Math.min(1,(minutes-FATIGUE_START)/(FATIGUE_FULL-FATIGUE_START))));
const fatigueXP=minutes=>1-.95*fatigueLevel(minutes);
const restedMinutes=(minutes,rest)=>Math.max(0,Math.min(FATIGUE_CAP,minutes)-FATIGUE_REST_RATE*Math.max(0,rest));
const strainedMinutes=(duration,physicalShare)=>Math.max(0,duration)*Math.min(1,Math.max(0,physicalShare)/40);
const afterFatigue=(current,duration,physicalShare)=>{
 const strain=strainedMinutes(duration,physicalShare);
 return Math.min(FATIGUE_CAP,Math.max(0,current+strain-FATIGUE_REST_RATE*(Math.max(0,duration)-strain)));
};
/** Warm-up as implemented in oss!idle shared/fatigue.ts (2026-10-24).
 * Based on accumulated strained minutes; affects gameplay only, never direct XP. */
const WARM_MINUTES=90,WARM_LADDER=10,WARM_SPEED=.1,WARM_HOLD=3,WARM_DECAY=.7;
const WARM_HALF=300,WARM_COLD=360;
const warmGear=upgrades=>{
 const u=Math.max(0,Math.floor(Number(upgrades)||0)),tiers=Math.max(0,u-WARM_LADDER);
 return Math.min(u,WARM_LADDER)+(1-WARM_DECAY**tiers)/(1-WARM_DECAY);
};
const warmRange=upgrades=>{
 const g=warmGear(upgrades),cold=Math.min(WARM_COLD+g*WARM_HOLD,FATIGUE_CAP);
 const half=Math.min(WARM_HALF+g*WARM_HOLD,cold),peakEnd=Math.min(WARM_MINUTES+g*WARM_HOLD,half);
 return {peakStart:Math.min(WARM_MINUTES/(1+g*WARM_SPEED),peakEnd),peakEnd,half,cold};
};
const warmEase=(m,from,to)=>to>from?cb(.4,0,.6,1)((m-from)/(to-from)):Number(m>=to);
const warmup=(minutes,upgrades=0)=>{
 const {peakStart,peakEnd,half,cold}=warmRange(upgrades),m=Math.max(0,Math.min(FATIGUE_CAP,Number(minutes)||0));
 if(m<peakStart)return warmEase(m,0,peakStart);
 if(m<half)return 1-.5*warmEase(m,peakEnd,half);
 return .5*(1-warmEase(m,half,cold));
};
/** Earliest estimated start-of-play peak for a strategy; short final map permitted. */
function warmPlan(start,upgrades,mapMinutes,physicalShare,breakMinutes){
 const {peakStart,peakEnd}=warmRange(upgrades);
 const initial=Math.max(0,Math.min(FATIGUE_CAP,Number(start)||0));
 const duration=Math.max(.1,Number(mapMinutes)||0),gap=Math.max(0,Number(breakMinutes)||0);
 if(initial>=peakStart&&initial<=peakEnd)return {kind:'ready',plays:0,minutes:0,last:0};
 if(initial>peakEnd)return {kind:'cooldown',plays:0,minutes:(initial-peakEnd)/FATIGUE_REST_RATE,last:0};
 const fraction=Math.min(1,Math.max(0,(Number(physicalShare)||0)/40));
 const rate=fraction-FATIGUE_REST_RATE*(1-fraction);
 if(rate<=0)return {kind:'impossible',plays:0,minutes:Infinity,last:0};
 let strained=initial,elapsed=0;
 for(let n=1;n<=5000;n++){
   const need=(peakStart-strained)/rate;
   if(need<=duration+1e-8)return {kind:'play',plays:n,minutes:elapsed+Math.max(0,need),last:Math.max(0,need)};
   strained=Math.min(FATIGUE_CAP,Math.max(0,strained+duration*rate));
   elapsed+=duration;
   if(strained>=peakStart&&strained<=peakEnd)return {kind:'play',plays:n,minutes:elapsed,last:duration};
   strained=restedMinutes(strained,gap);elapsed+=gap;
   if(n>2&&rate*duration<=FATIGUE_REST_RATE*gap+1e-8)break;
 }
 return {kind:'impossible',plays:0,minutes:Infinity,last:0};
}
const farmXP=(physical,memory,affected,block,minute,medal)=>({physical:physical*fatigueXP(minute)*medal,memory:memory*medal,affected:affected*block*medal});
function farmProjection(count,current,minutes,share,between,physical,memory,affected,repeats,medal){
 let state=Math.max(0,current),rows=[];
 for(let i=0;i<count;i++){
  if(i>0)state=restedMinutes(state,between);
  const block=1-.75*mind(Math.min(1,(repeats+i)/25)),parts=farmXP(physical,memory,affected,block,state,medal);
  if([0,4,19,49].includes(i))rows.push([i+1,state,parts.physical+parts.memory+parts.affected]);
  state=afterFatigue(state,minutes,share);
 }
 return rows;
}
const row=(label,value,detail='')=>'<div class="metric"><small>'+label+'</small><b>'+value+'</b><small>'+detail+'</small></div>';
const field=(k,label)=>'<label>'+label+'<input type="number" data-key="'+k+'" step="any" min="0" value="'+data[k]+'"></label>';
const grid=items=>'<div class="grid">'+items.join('')+'</div>';
const medalFields=()=>grid(Object.keys(MEDAL_RATES).map(k=>field(k,k[0].toUpperCase()+k.slice(1)+' medals')));
const playerState={status:'idle',error:'',rows:[],characterId:null,skill:'speed',name:'',medalStatus:'idle',medalError:'',medalUnknown:0,medalCharacterId:null};
const ui={odBuild:false,medalManual:false};
let playerRequest=0;
/** Use only the game's locally saved SQLite character snapshot; no writes or network. */
async function loadPlayerStats(){
 const request=++playerRequest;playerState.status='loading';playerState.error='';render();
 try{
  const [rows,latest]=await Promise.all([
   gameRead('SELECT * FROM character ORDER BY local ASC, current DESC, overallTotalXp DESC'),
   gameRead('SELECT characterId FROM score ORDER BY playedAt DESC LIMIT 1')
  ]);
  if(!root||request!==playerRequest)return;
  const selected=rows.find(r=>Number(r.id)===Number(playerState.characterId));
  const fallback=rows.find(r=>Number(r.local)===0)||rows.find(r=>Number(r.current)===1)||rows.find(r=>Number(r.id)===Number(latest[0]?.characterId))||rows[0];
  const character=selected||fallback;
  if(!character)throw Error('No character saved in the local game database.');
  const skill=SKILL_IDS.includes(playerState.skill)?playerState.skill:'speed';
  const names=[skill,skill+'XP',skill+'Upgrades',skill+'Overdrive',skill+'Prestige','overallTotalXp'];
  if(names.some(k=>!Number.isFinite(Number(character[k]))))throw Error('Local character is missing progression fields. Open your game profile and retry.');
  const level=realLevel(character[skill],character[skill+'XP']),prestige=Math.max(0,Math.floor(Number(character[skill+'Prestige'])));
  data.level=level;data.upgrades=Math.max(0,Math.floor(Number(character[skill+'Upgrades'])));
  data.overdrive=Math.max(0,Number(character[skill+'Overdrive']));data.prestige=prestige;
  data.improveSkill=skill;data.improveCurrent=level;data.improvePrestige=prestige;
  data.improveTarget=level+.1;data.overall=levelFromTotal(character.overallTotalXp);
  data.buyAt=Math.max(level,minLevel(data.upgrades));
  if(Number.isFinite(Number(character.staminaUpgrades)))data.staminaUpgrades=Math.max(0,Math.floor(Number(character.staminaUpgrades)));
  const characterId=Number(character.id);
  playerState.rows=rows;playerState.characterId=characterId;playerState.name=String(character.name||'Unnamed');playerState.status='ready';
  if(characterId>0&&!Number(character.local)){
   playerState.medalStatus='loading';playerState.medalError='';
   render();
   try{
    const {counts,unknown}=await fetchPlayerMedals(characterId);
    if(!root||request!==playerRequest)return;
    for(const [tier,n] of Object.entries(counts))data[tier]=n;
    playerState.medalStatus='ready';playerState.medalUnknown=unknown;playerState.medalCharacterId=characterId;
   }catch(error){
    if(!root||request!==playerRequest)return;
    playerState.medalStatus='error';playerState.medalError=error?.message||String(error);
    if(playerState.medalCharacterId!==characterId){
     for(const tier of Object.keys(MEDAL_RATES))data[tier]=0;
    }
   }
  }else{
   for(const tier of Object.keys(MEDAL_RATES))data[tier]=0;
   playerState.medalStatus='offline';playerState.medalCharacterId=null;playerState.medalError='';
  }
  try{localStorage.setItem(K,JSON.stringify(data));}catch{}
 }catch(e){
  if(!root||request!==playerRequest)return;
  playerState.status='error';playerState.error=e?.message||String(e);
 }
 render();
}
const playerControls=()=>{
 const picker='<label class="tool-picker">Skill<select data-player="skill">'+SKILL_IDS.map(id=>'<option value="'+id+'"'+(id===playerState.skill?' selected':'')+'>'+SKILL_LABELS[id]+'</option>').join('')+'</select></label>';
 const charPicker=playerState.rows.length?'<label>Character<select data-player="character">'+playerState.rows.map(r=>'<option value="'+Number(r.id)+'"'+(Number(r.id)===playerState.characterId?' selected':'')+'>'+safeText(r.name||'Unnamed')+'</option>').join('')+'</select></label>':'';
 const sync='<button class="action-button" data-action="load-stats"'+(playerState.status==='loading'?' disabled':'')+'>'+(playerState.status==='loading'?'Loading…':'↻ Use current player stats')+'</button>';
 const note=playerState.status==='ready'?'Loaded '+safeText(playerState.name)+' / '+safeText(SKILL_LABELS[playerState.skill])+' · saved game snapshot':
 playerState.status==='error'?safeText(playerState.error):'Read-only local character values';
 const status='<small class="'+(playerState.status==='error'?'notice':'fine')+'">'+note+'</small>';
 if(tab==='Overdrive')return '<div class="player-strip">'+picker+sync+status+'</div>'+(charPicker?'<details class="fold"><summary>Choose another character</summary>'+charPicker+'</details>':'');
 return '<div class="player-tools"><p><b>Saved character stats</b> — read-only local game snapshot. XP/play and fatigue remain manual.</p>'+grid([picker,charPicker])+sync+'<p>'+status+'</p></div>';
};
const medalSummary=m=>{
 const status=playerState.medalStatus==='ready'?'Auto-synced for '+safeText(playerState.name)+(playerState.medalUnknown?', '+playerState.medalUnknown+' unrecognized IDs':''):
 playerState.medalStatus==='loading'?'Fetching medals from public character profile…':
 playerState.medalStatus==='error'?'Automatic lookup unavailable: '+safeText(playerState.medalError):
 playerState.medalStatus==='offline'?'Guest/local character: enter medals manually':'Use current player stats to load medals automatically';
 const counts=Object.keys(MEDAL_RATES).map(t=>t[0].toUpperCase()+t.slice(1)+' '+Math.floor(val(t))).join(' · ');
 return '<div class="medal-strip"><b>🏅 Medals '+fmt(m,4)+'×</b><small>'+status+'</small>'+
 '<details class="fold" data-setting="medalManual"'+(ui.medalManual?' open':'')+'><summary>Medal counts / manual fallback</summary><p class="fine">'+counts+'</p>'+medalFields()+'</details></div>';
};

/** Optional friend manager. Unlike the calculators, this tool performs account writes
 * only after a manual batch approval. No messages, bulk discovery or auto-selection. */
const FRIEND_API='https://api.oss.idle.rhythmgamers.net/v1';
const FRIEND_DELAY_MS=6500; // strictly fewer than 10 write requests in any 60s span
const FRIEND_QUEUE_LIMIT=100;
const friendState={query:'',idText:'',results:[],selected:new Set(),queue:[],followed:new Set(),
 accountId:null,followers:null,idType:'character',ready:false,loading:false,running:false,approved:false,
 sent:0,skipped:0,error:'',message:''};
let friendEpoch=0,friendTimer=null,friendWake=null,friendNextAllowedAt=0;
const friendId=n=>{
 const v=Number(n);
 return Number.isSafeInteger(v)&&v>0?v:null;
};
function friendPause(reason='Queue paused.'){
 friendEpoch++;
 friendState.running=false;
 if(friendTimer!==null){clearTimeout(friendTimer);friendTimer=null;}
 if(friendWake){const done=friendWake;friendWake=null;done();}
 friendState.approved=false;
 friendState.message=reason;
 if(root&&section==='Friends')renderFriends();
}
function friendSession(){
 const desktop=typeof window!=='undefined'&&window.ossIdleDesktop?.isDesktop?window.ossIdleDesktop:null;
 const token=desktop?.getToken?.();
 if(desktop&&!token)throw Error('Sign into oss!idle on desktop before adding friends.');
 return {headers:token?{Authorization:'Bearer '+token}:{},credentials:desktop?'omit':'include'};
}
async function friendRequest(path,options={}){
 const auth=friendSession();
 const response=await fetch(FRIEND_API+path,{...options,headers:{...auth.headers,...(options.headers||{})},
  credentials:auth.credentials,signal:options.signal||(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(15000):undefined)});
 if(!response.ok){
  const detail=await response.json().catch(()=>({}));
  const message=typeof detail?.error==='string'?detail.error:typeof detail?.message==='string'?detail.message:'Request failed';
  const why=response.status===429?'Rate limit reached: stopped (no retry).':message+' (HTTP '+response.status+')';
  const error=Error((options.method||'GET')+' '+path+': '+why);
  error.status=response.status;
  throw error;
 }
 return response.json();
}
async function friendRefresh(){
 if(friendState.loading||friendState.running)return;
 friendState.loading=true;friendState.error='';renderFriends();
 try{
  const me=await friendRequest('/auth/me');
  if(!friendId(me.id))throw Error('Log into your oss!idle account first.');
  const [friends,relation]=await Promise.all([
   friendRequest('/social/friends'),
   friendRequest('/social/relation/'+me.id)
  ]);
  if(!root)return;
  if(!Array.isArray(friends))throw Error('Unexpected friend list from game.');
  const old=friendState.accountId;
  friendState.accountId=me.id;
  friendState.followed=new Set(friends.map(f=>friendId(f.userId)).filter(Boolean));
  friendState.followers=Math.max(0,Number(relation.followers)||0);
  friendState.ready=true;
  if(old!==null&&old!==me.id){friendState.queue=[];friendState.selected.clear();}
  friendState.queue=friendState.queue.filter(x=>x.id!==me.id&&!friendState.followed.has(x.id));
  friendState.message='Signed in; current follows and incoming follower count refreshed.';
 }catch(e){friendState.ready=false;friendState.error=e?.message||String(e);}
 finally{friendState.loading=false;renderFriends();}
}
async function friendSearch(){
 if(friendState.loading||friendState.running)return;
 const query=friendState.query.trim().slice(0,32);
 if(!query){friendState.error='Enter a player name to search.';renderFriends();return;}
 friendState.loading=true;friendState.error='';renderFriends();
 try{
  const players=await friendRequest('/characters/search?q='+encodeURIComponent(query));
  if(!root)return;
  if(!Array.isArray(players))throw Error('Unexpected player-search response.');
  const seen=new Set();
  friendState.results=players.filter(p=>{
   const id=friendId(p.userId);
   if(!id||id===friendState.accountId||seen.has(id))return false;
   seen.add(id);return true;
  }).map(p=>({id:Number(p.userId),name:String(p.character?.name||'Unnamed')}));
  friendState.selected.clear();
  friendState.message=friendState.results.length+' results; choose specific players to queue.';
 }catch(e){friendState.error=e?.message||String(e);}
 finally{friendState.loading=false;renderFriends();}
}
function friendAddQueue(items){
 const ids=new Set(friendState.queue.map(x=>x.id));
 let added=0;
 for(const item of items){
  const id=friendId(item.id);
  if(!id||id===friendState.accountId||friendState.followed.has(id)||ids.has(id))continue;
  if(friendState.queue.length>=FRIEND_QUEUE_LIMIT)break;
  const name=String(item.name||'Account #'+id).slice(0,60);
  friendState.queue.push({id,name});ids.add(id);added++;
 }
 friendState.approved=false;
 friendState.message='Queued '+added+' new account(s). Review the queue before starting.';
 renderFriends();
}
/** /web/c/:id is a character profile, NOT an account ID. */
function friendParseTarget(value,type='character'){
 const raw=String(value).trim();
 let url;
 if(/^https?:\/\//i.test(raw)){
  try{url=new URL(raw);}catch{throw Error('Invalid profile link.');}
  if(url.protocol!=='https:'||url.hostname!=='oss.idle.rhythmgamers.net')throw Error('Use an official oss!idle character-profile link.');
  const match=url.pathname.match(/^\/(?:web\/)?c\/(\d+)\/?$/);
  if(!match)throw Error('Expected a character profile ending in /c/123.');
  return {id:friendId(match[1]),type:'character'};
 }
 const local=raw.match(/^\/?(?:web\/)?c\/(\d+)\/?$/);
 if(local)return {id:friendId(local[1]),type:'character'};
 if(!/^\d+$/.test(raw))throw Error('Enter numeric IDs or character-profile links.');
 return {id:friendId(raw),type};
}
/** Resolve every pasted target before queueing; no unverified IDs are added. */
async function friendImportIds(){
 if(friendState.loading||friendState.running||!friendState.ready)return;
 const items=friendState.idText.split(/[\s,;]+/).filter(Boolean);
 if(items.length>FRIEND_QUEUE_LIMIT){friendState.error='Limit input to '+FRIEND_QUEUE_LIMIT+' entries per batch.';renderFriends();return;}
 if(!items.length){friendState.error='Paste a profile link or player ID first.';renderFriends();return;}
 friendState.loading=true;friendState.error='';friendState.message='';
 const epoch=friendEpoch;
 renderFriends();
 const resolved=[],rejected=[],seen=new Set();
 try{
  for(const input of items){
   if(epoch!==friendEpoch||!root)return;
   try{
    const target=friendParseTarget(input,friendState.idType);
    if(!target.id)throw Error('ID must be a positive integer.');
    const result=await friendRequest(target.type==='character'?'/characters/'+target.id:'/users/'+target.id);
    if(epoch!==friendEpoch||!root)return;
    const id=friendId(target.type==='character'?result.userId:result.id);
    if(!id)throw Error('No owning account was returned.');
    if(seen.has(id)||id===friendState.accountId||friendState.followed.has(id))continue;
    seen.add(id);
    resolved.push({id,name:String(target.type==='character'?result.name||'Character #'+target.id:result.username||'Account #'+id)});
   }catch(e){rejected.push(input+': '+(e?.message||String(e)));}
  }
  if(epoch!==friendEpoch||!root)return;
  friendAddQueue(resolved);
  friendState.error=rejected.length?'Not queued ('+rejected.length+'): '+rejected.slice(0,3).join(' · ')+(rejected.length>3?' · …':''):'';
  if(resolved.length)friendState.idText='';
  friendState.message='Validated '+resolved.length+' account(s) before queueing. '+(rejected.length?rejected.length+' entry/entries could not be resolved.':'');
 }finally{friendState.loading=false;renderFriends();}
}
function friendGap(ms){
 return new Promise(resolve=>{
  friendWake=resolve;
  friendTimer=setTimeout(()=>{friendTimer=null;friendWake=null;resolve();},ms);
 });
}
async function friendStart(){
 if(friendState.running||!friendState.ready||!friendState.approved||!friendState.queue.length)return;
 friendState.running=true;friendState.approved=false;friendState.error='';
 const run=++friendEpoch;
 renderFriends();
 try{
  // Re-check the active account and follows before any write.
  const me=await friendRequest('/auth/me');
  if(friendId(me.id)!==friendState.accountId)throw Error('Signed-in account changed. Refresh first.');
  const friends=await friendRequest('/social/friends');
  if(!Array.isArray(friends))throw Error('Unexpected friend list.');
  friendState.followed=new Set(friends.map(x=>friendId(x.userId)).filter(Boolean));
  while(run===friendEpoch&&friendState.queue.length){
   const target=friendState.queue[0];
   if(target.id===friendState.accountId||friendState.followed.has(target.id)){
    friendState.skipped++;friendState.queue.shift();renderFriends();continue;
   }
   // Preserve the 6.5s cooldown even if Stop/Start is clicked quickly.
   const wait=Math.max(0,friendNextAllowedAt-Date.now());
   if(wait)await friendGap(wait);
   if(run!==friendEpoch)break;
   // The game can return 404 for a character ID, closed account or invalid account.
   // Check the user route before using an authenticated write.
   try{
    const verified=await friendRequest('/users/'+target.id);
    if(friendId(verified.id)!==target.id)throw Error('Account lookup mismatch for #'+target.id);
   }catch(e){
    if(e?.status===404){
     friendState.skipped++;friendState.queue.shift();
     friendState.message='Skipped '+target.name+' (#'+target.id+'): account not found. Use a character-profile link or player-name search instead.';
     friendState.error=friendState.message;
     renderFriends();continue;
    }
    throw e;
   }
   if(run!==friendEpoch)break;
   try{await friendRequest('/social/friends/'+target.id,{method:'PUT'});}
   catch(e){
    if(e?.status===404){
     friendState.skipped++;friendState.queue.shift();
     friendState.message='Skipped '+target.name+' (#'+target.id+'): account disappeared or is unavailable. No friend added.';
     friendState.error=friendState.message;
     renderFriends();continue;
    }
    throw e;
   }finally{friendNextAllowedAt=Date.now()+FRIEND_DELAY_MS;}
   // PUT can succeed even when the user presses Stop during the request.
   friendState.followed.add(target.id);friendState.sent++;friendState.queue.shift();
   if(run!==friendEpoch)break;
   friendState.message='Added '+target.name+' (#'+target.id+'). No message sent.';
   renderFriends();

  }
  if(run===friendEpoch)friendState.message='Batch finished. You can ask for follow-backs manually.';
 }catch(e){if(run===friendEpoch){friendState.error=(e?.message||String(e))+' Queue stopped; refresh before restarting.';}}
 finally{
  if(run===friendEpoch)friendState.running=false;
  renderFriends();
 }
}
function renderFriends(){
 if(!root||section!=='Friends')return;
 const busy=friendState.loading||friendState.running;
 const disabled=busy?' disabled':'';
 const incoming=friendState.followers;
 const milestone=[1,5,25,100,1000].find(n=>incoming<n);
 const remaining=milestone?Math.max(0,milestone-incoming):0;
 const progress=incoming===null?'Sign in and refresh to see follower medals':milestone?fmt(incoming,0)+' / '+fmt(milestone,0)+' incoming · '+fmt(remaining,0)+' left':'1,000-follower Icon milestone reached!';
 const results=friendState.results.map(p=>{
  const followed=friendState.followed.has(p.id);
  return '<label class="friend-result"><input type="checkbox" data-friend-pick="'+p.id+'"'+(friendState.selected.has(p.id)?' checked':'')+(followed||busy?' disabled':'')+'><span>'+safeText(p.name)+' <small>#'+p.id+(followed?' · already added':'')+'</small></span></label>';
 }).join('');
 const rows=friendState.queue.map((x,i)=>[fmt(i+1,0),safeText(x.name),'#'+x.id]);
 const html='<h3>👥 Friend Manager</h3><p>Only adds players you personally choose. <b>Up to 10 adds/minute</b> (one request every 6.5 seconds). Messaging is always manual. No automatic player scraping or retries after rate limits.</p>'+
 '<div class="grid">'+row('Incoming followers',incoming===null?'—':fmt(incoming,0),'Other players adding you')+row('Next friendship medal',progress,'Icon requires 1,000 incoming followers')+'</div>'+
 '<p><button class="action-button" data-friend-action="refresh"'+disabled+'>↻ Verify login & refresh friends</button></p>'+
 (friendState.ready?'<p class="fine">Account #'+friendState.accountId+' · '+fmt(friendState.followed.size,0)+' players you added</p>':'<p class="fine">Log into the game and refresh before queueing players.</p>')+
 '<div class="friend-controls"><label>Find players by name<input type="text" data-friend-input="search" maxlength="32" placeholder="Exact or partial player name" value="'+safeText(friendState.query)+'"></label>'+
 '<button class="action-button" data-friend-action="search"'+disabled+'>Search players</button></div>'+
 (friendState.results.length?'<p class="fine">Select players below (none selected automatically).</p><div class="friend-results">'+results+'</div><p><button class="action-button" data-friend-action="queue-selected"'+disabled+'>Queue selected players</button></p>':'')+
 '<details class="fold"><summary>Paste character profiles or player IDs</summary>'+
 '<p class="fine">Profile links and numeric <b>character IDs</b> are resolved to their owning account before queueing. If your numbers are actual account IDs, switch the selector below. Unrecognized players are not added.</p>'+
 '<label>Type of bare numeric IDs<select data-friend-id-type'+(busy?' disabled':'')+'><option value="character"'+(friendState.idType==='character'?' selected':'')+'>Character ID (from profile URL)</option><option value="account"'+(friendState.idType==='account'?' selected':'')+'>Account / osu! user ID</option></select></label>'+
 '<label>Player profiles or IDs<textarea data-friend-input="ids" rows="3" placeholder="https://oss.idle.rhythmgamers.net/web/c/123 or 123, 456">'+safeText(friendState.idText)+'</textarea></label>'+
 '<p><button class="action-button" data-friend-action="queue-ids"'+disabled+'>Resolve & queue players</button></p></details>'+
 '<p class="section-label">Reviewed queue · '+friendState.queue.length+' / '+FRIEND_QUEUE_LIMIT+'</p>'+
 (friendState.queue.length?'<div class="friend-queue">'+tbl(['#','Player','Account ID'],rows)+'</div>':'<p class="fine">Queue is empty.</p>')+
 '<p class="checkline"><label><input type="checkbox" data-friend-approve'+(friendState.approved?' checked':'')+(busy?' disabled':'')+'> I chose these players and approve this batch of friend additions.</label></p>'+
 '<div class="friend-actions"><button class="action-button" data-friend-action="start"'+(!friendState.approved||!friendState.ready||!friendState.queue.length||busy?' disabled':'')+'>▶ Start adds (max 10/min)</button>'+
 '<button class="action-button" data-friend-action="pause"'+(!friendState.running?' disabled':'')+'>■ Stop</button>'+
 '<button class="action-button" data-friend-action="clear"'+disabled+'>Clear queue</button></div>'+
 '<p class="fine">Added this session: '+friendState.sent+' · skipped already added: '+friendState.skipped+'. Queue stops when you close the toolkit, change tabs, or disable the add-on.</p>'+
 (friendState.error?'<p class="notice">'+safeText(friendState.error)+'</p>':'')+
 (friendState.message?'<p class="fine">'+safeText(friendState.message)+'</p>':'');
 root.shadowRoot.querySelector('#contents').innerHTML=html;
}

const tbl=(names,rows)=>'<div class="scroll"><table><thead><tr>'+names.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function render(){
 if(section==='Discovery'){renderDiscovery();return;}
 if(section==='Friends'){renderFriends();return;}
 let c=playerControls(),u=Math.floor(val('upgrades')),p=Math.floor(val('prestige')),s=val('overdrive'),l=val('level'),xpRate=Math.max(1,val('xpPlay')),medalBoost=medals(data),currentBoost=boost(u,s,p,medalBoost),effectiveXpRate=xpRate*currentBoost;
 if(tab==='Improvement'){
 const current=val('improveCurrent'),target=val('improveTarget'),prestige=Math.floor(val('improvePrestige'));
 const choice=SKILL_IDS.includes(data.improveSkill)?data.improveSkill:'speed';
 const before=gameplayLevel(current+prestige),after=gameplayLevel(target+prestige);
 const pct=(a,b,better)=>Math.abs(a)<1e-12?'—':(better==='down'?(a-b)/Math.abs(a):(b-a)/Math.abs(a))*100;
 const change=(a,b,better)=>{const n=pct(a,b,better);return Number.isFinite(n)?(n>=0?'+':'')+fmt(n,3)+'%':'—';};
 const detail=(m,n)=>{const delta=n.value-m.value;return [m.label,fmt(m.value,5)+m.unit,fmt(n.value,5)+n.unit,(delta>=0?'+':'')+fmt(delta,5)+m.unit,change(m.value,n.value,m.better)];};
 const skillPicker='<label>Skill<select data-key="improveSkill">'+SKILL_IDS.map(id=>'<option value="'+id+'"'+(choice===id?' selected':'')+'>'+SKILL_LABELS[id]+'</option>').join('')+'</select></label>';
 c+='<p>Compare the real gameplay parameters of every skill. The game maps effective level (real XP level + prestige bonus) through a reduced high-level curve before applying each skill formula.</p>';
 c+=grid([skillPicker,field('improveCurrent','Current real XP level'),field('improveTarget','Target real XP level'),field('improvePrestige','Prestiges on this skill')]);
 c+=grid([row('Current effective level',fmt(current+prestige,3),'Includes '+prestige+' prestige bonus'),row('Target effective level',fmt(target+prestige,3)),row('Gameplay level',fmt(before,4)+' → '+fmt(after,4),'Internal skill strain curves'),row('Raw skill XP needed',target>=current?fmt(xpAt(target)-xpAt(current),0):'Target below current','Assumes same prestige, no upgrades')]);
 if(target<current)c+='<p class="fine">The target is lower than the current level: the table below shows the resulting decrease, not the cost of leveling.</p>';
 const selectedA=skillMetrics(choice,before),selectedB=skillMetrics(choice,after);
 c+='<p><b>'+SKILL_LABELS[choice]+' parameters</b> — positive percentages mean improvement in that specific parameter. Lower is better for errors, fatigue, and choke chance.</p>';
 c+=tbl(['Gameplay parameter','Current','Target','Change','Improvement'],selectedA.map((m,i)=>detail(m,selectedB[i])));
 const all=SKILL_IDS.map(id=>{const a=skillMetrics(id,before)[0],b=skillMetrics(id,after)[0];return [SKILL_LABELS[id],a.label,fmt(a.value,4)+a.unit,fmt(b.value,4)+b.unit,change(a.value,b.value,a.better)];});
 c+='<p><b>All 11 skills</b> — one representative game parameter per skill. Select a skill above to inspect all of its parameters.</p>';
 c+=tbl(['Skill','Parameter','Current','Target','Improvement'],all);
 c+='<p class="fine">These are exact per-level model parameter formulas, not a prediction of accuracy, clear rate, or overall performance on a particular map. NPS, strain rates, error factors, and percentages use different units and are not directly comparable across skills. XP earned includes no purchase spending and assumes an unchanged prestige count.</p>';
 }else if(tab==='Overdrive'){
 c+='<p class="fine">Choose a purchase level to compare the upgrade now vs. waiting. XP/play is the <b>base rate</b> before bonuses.</p>';
 c+=grid([field('buyAt','Purchase at level'),field('xpPlay','Base XP/play')]);
 c+='<details class="fold build-fold" data-setting="odBuild"'+(ui.odBuild?' open':'')+'><summary>Build inputs · Lv '+fmt(l,2)+' · '+u+' upgrades · '+fmt(s,2)+'σ · '+p+' prestige</summary>'+
 grid([field('level','Current XP level'),field('upgrades','Upgrades'),field('overdrive','Stored Overdrive σ'),field('prestige','Prestige')])+'</details>';
 c+=medalSummary(medalBoost);
 let req=minLevel(u),earliest=Math.max(l,req),choose=Math.max(earliest,val('buyAt')),q=preview(choose,u,s,p,medalBoost);
 // Keep the Overdrive status grid at four cards in every state: locked, eligible and maxed.
 const maxed=u>=10+p,eligible=!maxed&&l>=req,remaining=maxed?0:Math.max(0,xpAt(req)-xpAt(l)),now=eligible?preview(l,u,s,p,medalBoost):null;
 c+=grid([
   row('Current multiplier',fmt(currentBoost,4)+'×',fmt(s)+'σ · including medals'),
   row('Next upgrade',maxed?'MAXED':'Lv'+req,u+'/'+(10+p)+' slots'),
   row(maxed?'Upgrade slots':eligible?'Upgrade unlocked':'XP to unlock',
       maxed?'All filled':eligible?'READY':fmt(remaining,0),
       maxed?'Prestige for more slots':eligible?'Requirement met at Lv'+req:'Available at Lv'+req),
   row(maxed?'Next extra slot':eligible?'Overdrive if bought now':'Plays to unlock',
       maxed?'Prestige '+(p+1):eligible?'+'+fmt(now?.add??0)+'σ':fmt(Math.ceil(remaining/effectiveXpRate),0),
       maxed?'One extra slot per prestige':eligible?'At your current level':'At '+fmt(effectiveXpRate,0)+' boosted XP/play')
 ]);
 if(u===0)c+='<p class="fine">With 0 upgrades, your stored σ does not add XP by itself. Buying your first upgrade activates the upgrade bonus. Since your level is '+fmt(l)+', comparison rows begin at your current level rather than Lv'+req+'.</p>';
 if(q){
  // Fixed-rate estimate using the selected purchase level and current boosted XP/play.
  const plannedXP=Math.max(0,xpAt(choose)-xpAt(l));
  const plannedPlays=Math.ceil(plannedXP/effectiveXpRate);
  c+='<p class="section-label">Planned upgrade at Lv '+fmt(choose,2)+'</p>';
  c+=grid([row('Gain','+'+fmt(q.add)+'σ',fmt(q.newSigma)+'σ after'),
    row('New XP multiplier',fmt(q.newBoost,4)+'×','from '+fmt(currentBoost,4)+'×'),
    row('Level after purchase',fmt(q.after,3),'Costs '+fmt(q.cost,0)+' XP'),
    row('Plays to planned upgrade',fmt(plannedPlays,0),'At '+fmt(effectiveXpRate,0)+' boosted XP/play')]);
  c+='<p class="fine">XP until planned upgrade: '+fmt(plannedXP,0)+' · assumes the current boosted XP/play rate stays constant.</p>';
 }
 const candidates=[earliest,earliest+.1,earliest+.25,earliest+.5,earliest+1,earliest+2,choose],unique=[...new Set(candidates.map(n=>+n.toFixed(4)))].sort((a,b)=>a-b);
 let rows=[];for(const n of unique){let x=preview(n,u,s,p,medalBoost);if(x)rows.push(['Lv'+fmt(n)+(Math.abs(n-choose)<.00001?' ★':''),'+'+fmt(x.add)+'σ',fmt(x.newSigma)+'σ',fmt(x.newBoost,4)+'×',fmt(Math.max(0,xpAt(n)-xpAt(l)),0)]);}if(rows.length)c+='<details class="fold scenario-fold"><summary>Compare '+rows.length+' purchase levels</summary>'+tbl(['Buy at','Earn σ','Total σ','XP boost','XP to wait'],rows)+'</details>';
 }else if(tab==='Prestige'){
 c+='<p>Prestiging resets one skill to Lv0, loses upgrades and σ, but adds +10% permanent XP, +1 bonus level, +1 gear slot. Earned medals are retained.</p>'+grid([field('level','Current real XP level'),field('upgrades','Upgrades bought'),field('overdrive','Stored σ'),field('prestige','Previous prestiges'),field('xpPlay','Base skill XP/play before boosts')]);c+=medalSummary(medalBoost);
 let req=100+p,remaining=Math.max(0,xpAt(req)-xpAt(l));
 c+=grid([row('Next prestige','Lv'+req,fmt(remaining,0)+' XP remaining'),row('Estimated plays',fmt(Math.ceil(remaining/effectiveXpRate),0),'Fixed XP/play'),row('Multiplier now',fmt(currentBoost,4)+'×'),row('Multiplier after reset',fmt(Math.pow(1.1,p+1)*medalBoost,4)+'×','Zero upgrades and σ; medals retained'),row('Permanent prestige bonus',fmt(Math.pow(1.1,p+1))+'×','Medals listed separately'),row('Available slots after',fmt(11+p,0))]);
 }else if(tab==='Rebirth'){
 c+='<p>Overall level 110 needs approximately 2.202 billion cumulative unspent XP. Estimates assume no future purchases and unchanged XP rate.</p>'+grid([field('overall','Overall XP level'),field('totalXpPlay','Total skill XP/play before medal boosts'),field('minutes','Minutes per play'),field('hours','Hours farming per day')]);
 c+=medalSummary(medalBoost);let remaining=Math.max(0,to(110)-xpAt(val('overall'))),plays=Math.ceil(remaining/Math.max(1,val('totalXpPlay')*medalBoost));
 c+=grid([row('XP remaining',fmt(remaining,0)),row('Estimated plays',fmt(plays,0)),row('Total hours',fmt(plays*val('minutes')/60)),row('Days at schedule',fmt(plays*val('minutes')/60/Math.max(1,val('hours')))),row('Full rebirth threshold',fmt(to(110),0))]);
 c+=tbl(['Overall Lv','Cumulative XP'],[100,101,102,103,104,105,106,107,108,109,110].map(n=>[n,fmt(to(n),0)]));
 }else if(tab==='Farming'){
 c+='<p><b>Physical fatigue</b> affects Speed, Stamina and Jack Speed (5–7 strained hours: down to 5% XP). Memory is exempt from fatigue and Mindblock; other skills receive Mindblock. Fatigue rests 0.4 strained minutes per minute; 40% physical note strain means full strain.</p>'+
 grid([field('physical','Physical XP/play before medals'),field('memory','Memory XP/play before medals'),field('affected','Other skills XP/play before medals'),field('repeats','Prior same-map plays'),
 field('fatigueMinutes','Current fatigue (strained minutes)'),field('restMinutes','Rest since last play (minutes)'),
 field('strainShare','Physical note strain share (%)'),field('minutes','Minutes per map'),field('betweenMinutes','Idle gap between maps (minutes)')]);
 c+=medalSummary(medalBoost);
 const rested=restedMinutes(val('fatigueMinutes'),val('restMinutes'));
 const block=1-.75*mind(Math.min(1,val('repeats')/25)),parts=farmXP(val('physical'),val('memory'),val('affected'),block,rested,medalBoost),gained=parts.physical+parts.memory+parts.affected;
 const next=afterFatigue(rested,val('minutes'),val('strainShare')),projection=farmProjection(50,rested,val('minutes'),val('strainShare'),val('betweenMinutes'),val('physical'),val('memory'),val('affected'),val('repeats'),medalBoost);
 c+=grid([row('Physical XP kept',fmt(fatigueXP(rested)*100,2)+'%','Only Speed / Stamina / Jack Speed'),
 row('Mindblock XP kept',fmt(block*100,2)+'%','Other non-exempt skills'),
 row('Fatigue now',fmt(rested,1)+' min',fmt(fatigueLevel(rested)*100,1)+'% fatigue'),
 row('After this map',fmt(next,1)+' min','Physical note strain model'),
 row('Physical XP / map',fmt(parts.physical,0),'Fatigue × medals'),
 row('Total XP / map',fmt(gained,0),'Physical + Memory + other skills'),
 row('Total XP / minute',fmt(gained/Math.max(.01,val('minutes')),0),'Next map estimate'),
 row('Until full fatigue',fmt(Math.max(0,FATIGUE_FULL-rested),1)+' min','Remaining strained minutes')]);
 c+=tbl(['Upcoming play','Fatigue before','Total XP / play'],projection.map(([play,tired,earned])=>['#'+play,fmt(tired,1)+' min',fmt(earned,0)]));
 c+='<p class="fine">Manual fatigue is accumulated strained minutes, not total session time. XP values are before medals, but may include other bonuses. Projection assumes the same map and strain share, a fixed break between plays, and increasing same-map repetitions. Warm-up affects gameplay, not the direct XP multiplier, but can indirectly change XP earned.</p>';

 }else if(tab==='Warm-up'){
   const upgrades=Math.floor(val('staminaUpgrades')),initial=restedMinutes(val('fatigueMinutes'),val('restMinutes'));
   const range=warmRange(upgrades),progress=warmup(initial,upgrades),length=Math.max(.1,val('warmMapMinutes')),share=val('warmPhysicalShare'),gap=val('warmGapMinutes');
   c+='<p><b>🔥 Warm-up Planner</b> — estimate the shortest route to 100% warm-up for Speed, Stamina and Jack Speed. Warm-up affects gameplay performance, not direct XP.</p>';
   c+=grid([field('staminaUpgrades','Stamina upgrades'),field('fatigueMinutes','Stored strained minutes'),
      field('restMinutes','Minutes since last play'),field('warmMapMinutes','Typical map duration (min)'),
      field('warmPhysicalShare','Physical strain share (%)'),field('warmGapMinutes','Break between maps (min)')]);
   const perfect=warmPlan(initial,upgrades,length,40,0),selected=warmPlan(initial,upgrades,length,share,gap);
   const display=x=>x.kind==='ready'?'Already warm':x.kind==='impossible'?'Not reachable':fmt(x.minutes,1)+' min';
   c+=grid([row('Warm-up now',fmt(progress*100,1)+'%',fmt(initial,1)+' stored strained min'),
      row('Reach full warm-up',fmt(range.peakStart,1)+' min','Peak ends at '+fmt(range.peakEnd,1)),
      row('Theoretical fastest',display(perfect),'40%+ physical strain · no gaps'),
      row('Your map strategy',display(selected),selected.kind==='play'?fmt(selected.plays,0)+' plays · last ~'+fmt(selected.last,1)+' min':selected.kind==='cooldown'?'Rest to return to peak':selected.kind==='ready'?'Ready for a peak performance play':'Try harder maps or shorter breaks')]);
   const profiles=[['Full strain, no gaps',40,0],['Your map profile',share,gap],['Full strain, your breaks',40,gap],['30% physical strain',30,gap],['20% physical strain',20,gap],['10% physical strain',10,gap]];
   const plans=profiles.map(([name,rate,breaks])=>({name,rate,plan:warmPlan(initial,upgrades,length,rate,breaks)})).sort((a,b)=>a.plan.minutes-b.plan.minutes);
   c+='<p class="section-label">Warm-up route comparison</p>'+tbl(['Strategy','Time to peak','Plays','Final map'],plans.map((x,i)=>[
      (i===0?'★ ':'')+safeText(x.name),display(x.plan),x.plan.kind==='play'?fmt(x.plan.plays,0):'—',
      x.plan.kind==='play'?fmt(x.plan.last,1)+' min':x.plan.kind==='cooldown'?'Rest '+fmt(x.plan.minutes,1)+' min':'—']));
   c+=grid([row('Full warm-up window',fmt(Math.max(0,range.peakEnd-range.peakStart),1)+' strained min','100% before decline begins'),
      row('Half warm at',fmt(range.half,1)+' strained min'),
      row('Cold again at',fmt(range.cold,1)+' strained min'),
      row('Rest recovery',fmt(FATIGUE_REST_RATE,1)+' strained min/min','Recovery while idle or unstrained')]);
   c+='<p class="fine">Estimates model the official strain accumulation formula. Full strain means at least 40% of notes strain physical skills; particular maps may have different shares. The final map length is a <b>target</b>, not a command to stop a chart early. Warm-up is assessed at the next play start, not continuously during a map. Fatigue minutes and rest are shared with Farming and require manual entry; Stamina upgrades can auto-fill via Use current player stats. If strain already exceeds peak, resting is faster than harder maps. Warm-up does not directly affect XP.</p>';
 }
 root.shadowRoot.querySelector('#contents').innerHTML=c+'<p class="fine">Read-only calculations. Character stats come from local game saves; medal counts may be fetched from the public oss!idle character profile. No progress changes.</p>';
}
export function mount(){
 if(root)return;document.getElementById('theo-oss-idle-toolkit')?.remove();try{const saved=JSON.parse(localStorage.getItem(K)||'{}');data={...data,...saved};if(!Object.hasOwn(saved,'physical')&&Object.hasOwn(saved,'exempt')){data.physical=Math.max(0,Number(saved.exempt)||0);data.memory=0;}}catch{}
 root=document.createElement('div');root.id='theo-oss-idle-toolkit';root.attachShadow({mode:'open'});
 const css=':host{position:fixed;inset:0;z-index:50000;pointer-events:none;font-family:system-ui;color:#eee}:host *{box-sizing:border-box}:host button{cursor:pointer}:host .launch{position:absolute;bottom:19px;right:17px;border-radius:30px;border:1px solid #9771c9;background:#342150;color:#fff;padding:12px 15px;pointer-events:auto;font-weight:bold}:host .panel{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(700px,94vw);max-height:86vh;background:#181a2a;border:1px solid #62568a;border-radius:13px;box-shadow:0 5px 40px #000b;pointer-events:auto;overflow:hidden;flex-direction:column}:host(.open) .panel{display:flex}:host header{display:flex;align-items:center;justify-content:space-between;background:#35264a;padding:13px}:host h2{margin:0;font-size:18px}:host .close{border:0;background:#593e6c;color:#fff;padding:5px 10px}:host nav{display:flex;background:#27283a;overflow-x:auto;scrollbar-width:thin}:host .sections{display:flex;background:#242034;border-bottom:1px solid #54466d}:host .sections button{flex:1;border:0;padding:12px 8px;font-size:13px;font-weight:700;background:none;color:#c3bcdf;cursor:pointer}:host .sections button.active{background:#594076;color:white}:host([data-section=discovery]) nav.tools,:host([data-section=friends]) nav.tools{display:none}:host .map-link{color:#c7a5ff;text-decoration:none;font-weight:650}:host .map-link:hover{text-decoration:underline}:host .action-button{background:#543675;color:white;padding:9px 12px;border:1px solid #876eac;border-radius:7px}:host .notice{color:#ffbcc2}:host .checkline{display:flex;align-items:center;gap:9px;margin:10px 0}:host textarea{width:100%;padding:9px;resize:vertical;background:#090e20;color:white;border:1px solid #4b526b;border-radius:6px}:host .friend-controls,:host .friend-actions{display:flex;gap:9px;align-items:end;flex-wrap:wrap}:host .friend-controls label{flex:1}:host .friend-queue{max-height:230px;overflow:auto;border:1px solid #42506a;border-radius:8px}:host .friend-results{max-height:180px;overflow:auto;padding:6px;border:1px solid #42506a;border-radius:8px}:host .friend-result{display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #333a54}:host .friend-result input{width:auto;margin:0}:host .friend-result small{color:#99aec3}:host .friend-actions button{flex:1}:host .checkline input{width:auto;margin:0;accent-color:#a27ede}:host .scroll td small{display:block;color:#b7bdd0;font-size:10px}:host nav button{flex:1;min-width:72px;padding:11px 3px;font-size:12px;background:none;color:#c3bcdf;border:0}:host nav button.active{background:#49345c;color:white}:host #contents{overflow-y:auto;padding:15px}:host .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}:host label{font-size:12px;color:#bcc6d9}:host input,:host select{display:block;padding:9px;background:#090e20;color:white;border:1px solid #4b526b;border-radius:6px;width:100%;margin-top:3px}:host .metric{padding:11px;background:#272d44;border-radius:7px;min-width:0}:host .metric small{display:block;color:#aebbd2;font-size:10px}:host .metric b{display:block;font-size:19px;color:#f0e3ff;overflow-wrap:anywhere}:host p{font-size:12px;color:#c2cde0;margin:5px 0 11px}:host .scroll{overflow:auto}:host table{border-collapse:collapse;width:100%;white-space:nowrap;font-size:11px}:host td,:host th{padding:7px;border-bottom:1px solid #3c4359;text-align:left}:host .fine{font-size:10px;color:#9ba9c3}:host .player-strip{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin-bottom:10px;padding:9px 10px;background:#242739;border:1px solid #3c4260;border-radius:10px}:host .player-strip .tool-picker{width:180px;flex:1 1 150px}:host .player-strip button{padding:10px 12px;border-radius:7px;white-space:nowrap}:host .player-strip small{flex:1 1 100%;margin-top:0}:host .medal-strip{background:#1e2b37;border:1px solid #3b5162;padding:8px 11px;margin:8px 0 12px;border-radius:9px;display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px}:host .medal-strip>b{font-size:13px;color:#dbeaff}:host .medal-strip>small{font-size:11px;color:#a9bacd;flex:1}:host details.fold{border:1px solid #3a425e;border-radius:8px;margin:10px 0;background:#202537}:host details.fold summary{cursor:pointer;user-select:none;padding:10px 12px;font-size:12px;color:#c8c7eb;font-weight:650;list-style:disclosure-closed}:host details.fold[open] summary{border-bottom:1px solid #3a425e;list-style:disclosure-open}:host details.fold .grid,:host details.fold label,:host details.fold p,:host details.fold .scroll{margin:10px}:host .medal-strip details.fold{flex:1 1 100%;margin:2px 0 0;border:0;background:transparent}:host .medal-strip details.fold summary{padding:4px 0;font-size:11px}:host .medal-strip details.fold .grid{margin:8px 0}:host .section-label{font-size:12px;color:#ede5ff;font-weight:700;margin-top:15px}:host .scenario-fold .scroll{max-height:260px}:host .panel{width:min(740px,95vw)}:host .metric{padding:9px}:host .metric b{font-size:17px}:host .grid{gap:7px}:host input,:host select{padding:8px}:host .player-tools .grid{margin:6px 0}:host details.fold .tool-picker{margin-bottom:8px}@media(max-width:480px){:host .panel{width:97vw;max-height:90vh}:host .player-strip button{flex:1 1 auto}:host nav button{font-size:10px;padding:9px 1px}:host .metric b{font-size:15px}}';
 root.shadowRoot.innerHTML='<style>'+css+'</style><div class="panel"><header><h2>⚡ Theo’s Progression Toolkit <small style="font-size:11px;opacity:.8">Ctrl+Shift+P • Esc to close</small></h2><button class="close">×</button></header><div class="sections">'+['Calculators','Discovery','Friends'].map(x=>'<button data-section="'+x+'"'+(section===x?' class="active"':'')+'>'+x+'</button>').join('')+'</div><nav class="tools">'+['Improvement','Overdrive','Prestige','Rebirth','Farming','Warm-up'].map(x=>'<button data-tab="'+x+'">'+x+'</button>').join('')+'</nav><div id="contents"></div></div>';
 root.shadowRoot.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.classList.contains('close')){friendPause('Stopped when toolkit closed.');root.classList.remove('open');}
 if(b.dataset.section){
  if(section==='Friends'&&b.dataset.section!=='Friends')friendPause('Stopped when changing tabs.');
  section=b.dataset.section;root.dataset.section=section.toLowerCase();
  root.shadowRoot.querySelectorAll('.sections button').forEach(n=>n.classList.toggle('active',n.dataset.section===section));
  render();if(section==='Discovery'&&mapState.status==='idle')void loadMapDiscovery();
 }
 if(b.dataset.tab){if(section==='Friends')friendPause('Stopped when changing tabs.');section='Calculators';tab=b.dataset.tab;root.dataset.section='calculators';
  root.shadowRoot.querySelectorAll('.tools button').forEach(n=>n.classList.toggle('active',n.dataset.tab===tab));render();}
 if(b.dataset.action==='refresh-maps'&&mapState.status!=='loading')void loadMapDiscovery();
  const action=b.dataset.friendAction;
  if(action==='refresh')void friendRefresh();
  if(action==='search')void friendSearch();
  if(action==='queue-selected')friendAddQueue(friendState.results.filter(x=>friendState.selected.has(x.id)));
  if(action==='queue-ids')void friendImportIds();
  if(action==='start')void friendStart();
  if(action==='pause')friendPause('Stopped by you. Refresh before restarting.');
  if(action==='clear'&&!friendState.running){friendState.queue=[];friendState.approved=false;renderFriends();}
  if(b.dataset.action==='load-stats'&&playerState.status!=='loading')void loadPlayerStats();
 e.stopPropagation();
});
 root.shadowRoot.addEventListener('toggle',e=>{if(e.target?.dataset?.setting in ui)ui[e.target.dataset.setting]=e.target.open;},true);
 root.shadowRoot.addEventListener('change',e=>{
  if(e.target.hasAttribute?.('data-friend-id-type')){
   if(e.target.value==='character'||e.target.value==='account')friendState.idType=e.target.value;
   e.stopPropagation();return;
  }
  const pick=e.target.dataset?.friendPick;
  if(pick){const id=friendId(pick);if(id){if(e.target.checked)friendState.selected.add(id);else friendState.selected.delete(id);}e.stopPropagation();return;}
  if(e.target.hasAttribute?.('data-friend-approve')){friendState.approved=Boolean(e.target.checked);renderFriends();e.stopPropagation();return;}
 const pc=e.target.dataset.player;
  if(pc==='skill'&&SKILL_IDS.includes(e.target.value)){playerState.skill=e.target.value;playerState.status='idle';render();e.stopPropagation();return;}
  if(pc==='character'){playerState.characterId=Number(e.target.value);playerState.status='idle';render();e.stopPropagation();return;}
  const m=e.target.dataset.mapFilter;
 if(m&&mapState.status==='ready'){
  if(m==='character'){mapState.characterId=Number(e.target.value);void loadMapDiscovery();}
  else{mapState[m]=m==='unplayed'?Boolean(e.target.checked):e.target.value;renderDiscovery();}
 }else{const k=e.target.dataset.key;
  if(k){data[k]=k==='improveSkill'?e.target.value:+e.target.value;if(k==='improveSkill')playerState.skill=data[k];try{localStorage.setItem(K,JSON.stringify(data));}catch{}render();}
 }
 e.stopPropagation();
});
root.shadowRoot.addEventListener('input',e=>{
  const field=e.target.dataset?.friendInput;
  if(field==='search')friendState.query=String(e.target.value);
  if(field==='ids')friendState.idText=String(e.target.value);
 if(e.target.dataset.mapFilter==='query'&&mapState.status==='ready'){
  mapState.query=e.target.value;renderMapResults();
 }
 e.stopPropagation();
});
 root.shadowRoot.addEventListener('keydown',e=>e.stopPropagation());root.shadowRoot.addEventListener('keyup',e=>e.stopPropagation());root.dataset.section=section.toLowerCase();document.body.appendChild(root);root.shadowRoot.querySelector('[data-tab="Improvement"]').classList.add('active');render();
 // Capture before the game's own key listeners; only block the exact shortcut.
 hotkeyHandler=e=>{
   const toggle=e.ctrlKey&&e.shiftKey&&!e.altKey&&!e.metaKey&&(e.code==='KeyP'||(e.key||'').toLowerCase()==='p');
   if(toggle){
     e.preventDefault();e.stopImmediatePropagation();
     if(!e.repeat){if(root?.classList.contains('open'))friendPause('Stopped when toolkit closed.');root?.classList.toggle('open');}
   }else if(e.key==='Escape'&&root?.classList.contains('open')){
     e.preventDefault();e.stopImmediatePropagation();friendPause('Stopped when toolkit closed.');root.classList.remove('open');
   }
 };
 window.addEventListener('keydown',hotkeyHandler,true);console.info('[Theo Progression Toolkit] Mounted v0.5.6. Press Ctrl+Shift+P.');
}
export function unmount(){
 friendPause('Stopped: add-on unloaded.');
 if(hotkeyHandler)window.removeEventListener('keydown',hotkeyHandler,true);
 hotkeyHandler=null;mapRequest++;playerRequest++;playerState.status='idle';playerState.medalStatus='idle';playerState.rows=[];playerState.characterId=null;playerState.medalCharacterId=null;ui.medalManual=false;ui.odBuild=false;friendState.ready=false;friendState.queue=[];friendState.results=[];friendState.selected.clear();section='Calculators';tab='Improvement';mapState.status='idle';mapState.sets=[];mapState.characters=[];mapState.played=new Map();
 root?.remove();root=null;
}
