/* Theo's oss!idle Progression Toolkit v0.4.1 — in-game add-on source.
   Press Ctrl+Shift+P to toggle the calculator, Esc to close it.
   Read-only; AGPL-3.0-only. Exports mount() and unmount(). */
const K='oss-idle-addon:theo-progression-toolkit-v1', A={level:90,upgrades:9,overdrive:15,prestige:1,buyAt:100.25,xpPlay:30000,overall:100.13,totalXpPlay:90000,minutes:4,hours:5,repeats:10,exempt:30000,affected:10000,improveCurrent:100,improveTarget:100.1,improvePrestige:0,improveSkill:'speed',bronze:0,silver:0,gold:0,platinum:0,divine:0};
let data={...A},root=null,tab='Improvement',section='Calculators',hotkeyHandler=null;
const val=k=>Math.max(0,+data[k]||0),fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
function cb(x0,y0,x1,y1){let ax=1-(x1=3*(x1-x0)-(x0*=3))-x0,ay=1-(y1=3*(y1-y0)-(y0*=3))-y0;return t=>{if(t<=0)return 0;if(t>=1)return 1;let r=t,s=0,d=1,x;for(let i=0;i<32;i++){x=r*(r*(r*ax+x1)+x0)-t;if(Math.abs(x)<1e-5)break;let dv=r*(r*ax*3+x1*2)+x0;if(Math.abs(dv)<1e-5)break;r-=x/dv;}if(r<0||r>1){r=t;for(let i=0;i<60;i++){x=r*(r*(r*ax+x1)+x0);if(Math.abs(x-t)<1e-5)break;if(t>x)s=r;else d=r;r=(d+s)/2;}}return r*(r*(r*ay+y1)+y0);};}
const early=cb(.1,.4,.95,0),late=cb(.5,0,1,.4),mind=cb(.6,0,.6,1);
const xp=n=>100+9900*early(n/100)+90000*late((n-60)/40)+(n<100?0:5e6*(n-99)*(n-98));
const xpTotal=[0];function to(n){n=Math.max(0,Math.floor(n));while(xpTotal.length<=n){let x=xpTotal.length-1;xpTotal.push(xpTotal[x]+xp(x));}return xpTotal[n];}
const xpAt=n=>to(Math.floor(n))+(n%1)*xp(Math.floor(n));
const sigma=n=>Math.max(1,Math.min(n,2.5*Math.pow(n,Math.log10(2))));
/** Medal bonuses compound per owned medal, in a separate XP multiplier pool. */
const MEDAL_RATES={bronze:.0025,silver:.005,gold:.01,platinum:.02,divine:.03};
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
  played:new Map(),query:'',sort:'stars',keys:'all',limit:'all',unplayed:true};
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
}))).filter(x=>x.mode===3&&Number.isInteger(x.id)&&x.id>0&&Number.isFinite(x.stars)&&x.stars>=0&&Number.isFinite(x.objects))
  .filter(x=>(!mapState.unplayed||!x.plays)
    &&(mapState.keys==='all'||x.keys===Number(mapState.keys))
    &&(mapState.limit==='all'||x.stars<=Number(mapState.limit))
    &&(!mapState.query||(x.title+' '+x.artist+' '+x.difficulty+' '+x.id).toLowerCase().includes(mapState.query.toLowerCase())))
  .sort((a,b)=>mapState.sort==='notes'?a.objects-b.objects||a.stars-b.stars:
    mapState.sort==='title'?a.title.localeCompare(b.title)||a.stars-b.stars:
    mapState.sort==='hardest'?b.stars-a.stars:a.stars-b.stars||a.title.localeCompare(b.title));
function renderMapResults(){
 const target=root?.shadowRoot.querySelector('#map-results');
 if(!target||mapState.status!=='ready')return;
 const found=mapMatches(),visible=found.slice(0,80);
 const uniqueAll=mapState.sets.flatMap(x=>x.versions||[]).filter(x=>Number(x.mode)===3).length;
 target.innerHTML=grid([
  row('Downloaded mania charts',fmt(uniqueAll,0),'Stored in this browser'),
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
 let c='<p>Explore downloaded osu!mania charts and find maps without a score in your <b>local play history</b>. This is a read-only lookup, not the live ranked catalog.</p>';
 if(mapState.status==='loading')c+='<p>Reading local beatmaps and scores…</p>';
 else if(mapState.status==='error')c+='<p class="notice">'+safeText(mapState.error)+'</p>';
 else if(mapState.status==='idle')c+='<p>Select Refresh to load your downloaded maps.</p>';
 if(mapState.status==='ready'){
  const char=mapState.characters.find(x=>Number(x.id)===mapState.characterId);
  c+=grid([
   mapSelect('Character',{name:'character',items:mapState.characters.map(x=>[x.id,x.name+' ('+(Number(x.local)?'local':'account')+')'])},mapState.characterId),
   mapSelect('Keys',{name:'keys',items:[['all','All key modes'],['4','4 keys'],['7','7 keys']]},mapState.keys),
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

const row=(label,value,detail='')=>'<div class="metric"><small>'+label+'</small><b>'+value+'</b><small>'+detail+'</small></div>';
const field=(k,label)=>'<label>'+label+'<input type="number" data-key="'+k+'" step="any" min="0" value="'+data[k]+'"></label>';
const grid=items=>'<div class="grid">'+items.join('')+'</div>';
const medalFields=()=>grid(Object.keys(MEDAL_RATES).map(k=>field(k,k[0].toUpperCase()+k.slice(1)+' medals')));
const medalSummary=m=>grid([row('Medal XP multiplier',fmt(m,4)+'×','Compounded across all earned medals'),row('Medal rates','0.25% · 0.5% · 1%','Bronze, Silver, Gold · Platinum 2% · Divine 3%')]);
const tbl=(names,rows)=>'<div class="scroll"><table><thead><tr>'+names.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function render(){
 if(section==='Discovery'){renderDiscovery();return;}
 let c='',u=Math.floor(val('upgrades')),p=Math.floor(val('prestige')),s=val('overdrive'),l=val('level'),xpRate=Math.max(1,val('xpPlay')),medalBoost=medals(data),currentBoost=boost(u,s,p,medalBoost),effectiveXpRate=xpRate*currentBoost;
 if(tab==='Improvement'){
 const current=val('improveCurrent'),target=val('improveTarget'),prestige=Math.floor(val('improvePrestige'));
 const choice=SKILL_IDS.includes(data.improveSkill)?data.improveSkill:'speed';
 const before=gameplayLevel(current+prestige),after=gameplayLevel(target+prestige);
 const pct=(a,b,better)=>Math.abs(a)<1e-12?'—':(better==='down'?(a-b)/Math.abs(a):(b-a)/Math.abs(a))*100;
 const change=(a,b,better)=>{const n=pct(a,b,better);return Number.isFinite(n)?(n>=0?'+':'')+fmt(n,3)+'%':'—';};
 const detail=(m,n)=>{const delta=n.value-m.value;return [m.label,fmt(m.value,5)+m.unit,fmt(n.value,5)+n.unit,(delta>=0?'+':'')+fmt(delta,5)+m.unit,change(m.value,n.value,m.better)];};
 const skillPicker='<label>Skill<select data-key="improveSkill">'+SKILL_IDS.map(id=>'<option value="'+id+'"'+(choice===id?' selected':'')+'>'+SKILL_LABELS[id]+'</option>').join('')+'</select></label>';
 c='<p>Compare the real gameplay parameters of every skill. The game maps effective level (real XP level + prestige bonus) through a reduced high-level curve before applying each skill formula.</p>';
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
 c='<p>Preview an upgrade at any level. Current defaults match your Speed build.</p>'+grid([field('level','Current real XP level'),field('upgrades','Upgrades bought'),field('overdrive','Stored Overdrive σ'),field('prestige','Prestige count'),field('buyAt','Plan to buy at XP level'),field('xpPlay','Base skill XP/play before boosts')]);c+=medalFields();c+=medalSummary(medalBoost);
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
 if(q)c+=grid([row('Overdrive gained','+'+fmt(q.add)+'σ',fmt(q.newSigma)+'σ total'),row('Multiplier after',fmt(q.newBoost,4)+'×','from '+fmt(currentBoost,4)+'×'),row('Skill level after',fmt(q.after),'Spends '+fmt(q.cost,0)+' XP'),row('XP to planned purchase',fmt(Math.max(0,xpAt(choose)-xpAt(l)),0),fmt(Math.ceil(Math.max(0,xpAt(choose)-xpAt(l))/effectiveXpRate),0)+' plays')]);
 const candidates=[earliest,earliest+.1,earliest+.25,earliest+.5,earliest+1,earliest+2,choose],unique=[...new Set(candidates.map(n=>+n.toFixed(4)))].sort((a,b)=>a-b);
 let rows=[];for(const n of unique){let x=preview(n,u,s,p,medalBoost);if(x)rows.push(['Lv'+fmt(n)+(Math.abs(n-choose)<.00001?' ★':''),'+'+fmt(x.add)+'σ',fmt(x.newSigma)+'σ',fmt(x.newBoost,4)+'×',fmt(Math.max(0,xpAt(n)-xpAt(l)),0)]);}if(rows.length)c+=tbl(['Buy at','Earn σ','Total σ','XP boost','XP to wait'],rows);
 }else if(tab==='Prestige'){
 c='<p>Prestiging resets one skill to Lv0, loses upgrades and σ, but adds +10% permanent XP, +1 bonus level, +1 gear slot. Earned medals are retained.</p>'+grid([field('level','Current real XP level'),field('upgrades','Upgrades bought'),field('overdrive','Stored σ'),field('prestige','Previous prestiges'),field('xpPlay','Base skill XP/play before boosts')]);c+=medalFields();c+=medalSummary(medalBoost);
 let req=100+p,remaining=Math.max(0,xpAt(req)-xpAt(l));
 c+=grid([row('Next prestige','Lv'+req,fmt(remaining,0)+' XP remaining'),row('Estimated plays',fmt(Math.ceil(remaining/effectiveXpRate),0),'Fixed XP/play'),row('Multiplier now',fmt(currentBoost,4)+'×'),row('Multiplier after reset',fmt(Math.pow(1.1,p+1)*medalBoost,4)+'×','Zero upgrades and σ; medals retained'),row('Permanent prestige bonus',fmt(Math.pow(1.1,p+1))+'×','Medals listed separately'),row('Available slots after',fmt(11+p,0))]);
 }else if(tab==='Rebirth'){
 c='<p>Overall level 110 needs approximately 2.202 billion cumulative unspent XP. Estimates assume no future purchases and unchanged XP rate.</p>'+grid([field('overall','Overall XP level'),field('totalXpPlay','Total skill XP/play before medal boosts'),field('minutes','Minutes per play'),field('hours','Hours farming per day')]);
 c+=medalFields();c+=medalSummary(medalBoost);let remaining=Math.max(0,to(110)-xpAt(val('overall'))),plays=Math.ceil(remaining/Math.max(1,val('totalXpPlay')*medalBoost));
 c+=grid([row('XP remaining',fmt(remaining,0)),row('Estimated plays',fmt(plays,0)),row('Total hours',fmt(plays*val('minutes')/60)),row('Days at schedule',fmt(plays*val('minutes')/60/Math.max(1,val('hours')))),row('Full rebirth threshold',fmt(to(110),0))]);
 c+=tbl(['Overall Lv','Cumulative XP'],[100,101,102,103,104,105,106,107,108,109,110].map(n=>[n,fmt(to(n),0)]));
 }else{
 c='<p>Mindblock is capped at a 75% reduction after 25 previous same-map plays. Speed, Jack Speed, Stamina and Memory are exempt.</p>'+grid([field('repeats','Recent same-map plays'),field('exempt','Base XP/play from exempt skills'),field('affected','Base XP/play from affected skills'),field('minutes','Minutes per play')]);
 c+=medalFields();c+=medalSummary(medalBoost);let m=1-.75*mind(Math.min(1,val('repeats')/25)),gained=(val('exempt')+val('affected')*m)*medalBoost;
 c+=grid([row('Penalty',fmt((1-m)*100)+'%'),row('Affected XP kept',fmt(m*100)+'%'),row('XP per play',fmt(gained,0)),row('XP per minute',fmt(gained/Math.max(.01,val('minutes')),0))]);
 c+=tbl(['Prior plays','XP reduction','XP retained'],[0,5,10,15,20,25].map(n=>[n,fmt(75*mind(n/25))+'%',fmt(100-75*mind(n/25))+'%']));
 }
 root.shadowRoot.querySelector('#contents').innerHTML=c+'<p class="fine">Read-only. Based on oss!idle public progression formulas. Does not access account data or change game progress.</p>';
}
export function mount(){
 if(root)return;document.getElementById('theo-oss-idle-toolkit')?.remove();try{data={...data,...JSON.parse(localStorage.getItem(K)||'{}')};}catch{}
 root=document.createElement('div');root.id='theo-oss-idle-toolkit';root.attachShadow({mode:'open'});
 const css=':host{position:fixed;inset:0;z-index:50000;pointer-events:none;font-family:system-ui;color:#eee}:host *{box-sizing:border-box}:host button{cursor:pointer}:host .launch{position:absolute;bottom:19px;right:17px;border-radius:30px;border:1px solid #9771c9;background:#342150;color:#fff;padding:12px 15px;pointer-events:auto;font-weight:bold}:host .panel{display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(700px,94vw);max-height:86vh;background:#181a2a;border:1px solid #62568a;border-radius:13px;box-shadow:0 5px 40px #000b;pointer-events:auto;overflow:hidden;flex-direction:column}:host(.open) .panel{display:flex}:host header{display:flex;align-items:center;justify-content:space-between;background:#35264a;padding:13px}:host h2{margin:0;font-size:18px}:host .close{border:0;background:#593e6c;color:#fff;padding:5px 10px}:host nav{display:flex;background:#27283a}:host .sections{display:flex;background:#242034;border-bottom:1px solid #54466d}:host .sections button{flex:1;border:0;padding:12px 8px;font-size:13px;font-weight:700;background:none;color:#c3bcdf;cursor:pointer}:host .sections button.active{background:#594076;color:white}:host([data-section=discovery]) nav.tools{display:none}:host .map-link{color:#c7a5ff;text-decoration:none;font-weight:650}:host .map-link:hover{text-decoration:underline}:host .action-button{background:#543675;color:white;padding:9px 12px;border:1px solid #876eac;border-radius:7px}:host .notice{color:#ffbcc2}:host .checkline{display:flex;align-items:center;gap:9px;margin:10px 0}:host .checkline input{width:auto;margin:0;accent-color:#a27ede}:host .scroll td small{display:block;color:#b7bdd0;font-size:10px}:host nav button{flex:1;min-width:0;padding:11px 3px;font-size:12px;background:none;color:#c3bcdf;border:0}:host nav button.active{background:#49345c;color:white}:host #contents{overflow-y:auto;padding:15px}:host .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}:host label{font-size:12px;color:#bcc6d9}:host input,:host select{display:block;padding:9px;background:#090e20;color:white;border:1px solid #4b526b;border-radius:6px;width:100%;margin-top:3px}:host .metric{padding:11px;background:#272d44;border-radius:7px;min-width:0}:host .metric small{display:block;color:#aebbd2;font-size:10px}:host .metric b{display:block;font-size:19px;color:#f0e3ff;overflow-wrap:anywhere}:host p{font-size:12px;color:#c2cde0;margin:5px 0 11px}:host .scroll{overflow:auto}:host table{border-collapse:collapse;width:100%;white-space:nowrap;font-size:11px}:host td,:host th{padding:7px;border-bottom:1px solid #3c4359;text-align:left}:host .fine{font-size:10px;color:#9ba9c3}';
 root.shadowRoot.innerHTML='<style>'+css+'</style><div class="panel"><header><h2>⚡ Theo’s Progression Toolkit <small style="font-size:11px;opacity:.8">Ctrl+Shift+P • Esc to close</small></h2><button class="close">×</button></header><div class="sections">'+['Calculators','Discovery'].map(x=>'<button data-section="'+x+'"'+(section===x?' class="active"':'')+'>'+x+'</button>').join('')+'</div><nav class="tools">'+['Improvement','Overdrive','Prestige','Rebirth','Farming'].map(x=>'<button data-tab="'+x+'">'+x+'</button>').join('')+'</nav><div id="contents"></div></div>';
 root.shadowRoot.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.classList.contains('close'))root.classList.remove('open');
 if(b.dataset.section){
  section=b.dataset.section;root.dataset.section=section.toLowerCase();
  root.shadowRoot.querySelectorAll('.sections button').forEach(n=>n.classList.toggle('active',n.dataset.section===section));
  render();if(section==='Discovery'&&mapState.status==='idle')void loadMapDiscovery();
 }
 if(b.dataset.tab){section='Calculators';tab=b.dataset.tab;root.dataset.section='calculators';
  root.shadowRoot.querySelectorAll('.tools button').forEach(n=>n.classList.toggle('active',n.dataset.tab===tab));render();}
 if(b.dataset.action==='refresh-maps'&&mapState.status!=='loading')void loadMapDiscovery();
 e.stopPropagation();
});
 root.shadowRoot.addEventListener('change',e=>{
 const m=e.target.dataset.mapFilter;
 if(m&&mapState.status==='ready'){
  if(m==='character'){mapState.characterId=Number(e.target.value);void loadMapDiscovery();}
  else{mapState[m]=m==='unplayed'?Boolean(e.target.checked):e.target.value;renderDiscovery();}
 }else{const k=e.target.dataset.key;
  if(k){data[k]=k==='improveSkill'?e.target.value:+e.target.value;try{localStorage.setItem(K,JSON.stringify(data));}catch{}render();}
 }
 e.stopPropagation();
});
root.shadowRoot.addEventListener('input',e=>{
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
     if(!e.repeat)root?.classList.toggle('open');
   }else if(e.key==='Escape'&&root?.classList.contains('open')){
     e.preventDefault();e.stopImmediatePropagation();root.classList.remove('open');
   }
 };
 window.addEventListener('keydown',hotkeyHandler,true);console.info('[Theo Progression Toolkit] Mounted v0.4.1. Press Ctrl+Shift+P.');
}
export function unmount(){
 if(hotkeyHandler)window.removeEventListener('keydown',hotkeyHandler,true);
 hotkeyHandler=null;mapRequest++;section='Calculators';tab='Improvement';mapState.status='idle';mapState.sets=[];mapState.characters=[];mapState.played=new Map();
 root?.remove();root=null;
}
