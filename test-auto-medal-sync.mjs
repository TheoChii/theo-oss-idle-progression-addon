import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const code=await fs.readFile(new URL('./progression-toolkit.addon.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(code+'\nexport { MEDAL_TIER_BY_ID, medalCountsFromIds, fetchPlayerMedals, playerState, data, medals, ui };').toString('base64'));
const {MEDAL_TIER_BY_ID,medalCountsFromIds,fetchPlayerMedals,playerState,data,medals,ui}=mod;
assert.equal(MEDAL_TIER_BY_ID.size,135);
const summary=medalCountsFromIds(['pass-1','pass-2','grade-x','speed-100','speed-105','rebirth','future-medal','grade-x']);
assert.deepEqual(summary.counts,{bronze:2,silver:0,gold:2,platinum:1,divine:1});
assert.equal(summary.unknown,1);
assert(Math.abs(medals(summary.counts)-(1.0025**2*1.01**2*1.02*1.03))<1e-10);
const handlers={},contents={innerHTML:''};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window=new EventTarget();
const characters=[
 {id:42,name:'Live <user>',local:0,current:0,overallTotalXp:20000000,speed:100,speedXP:1000,speedUpgrades:8,speedOverdrive:4,speedPrestige:1},
 {id:-1,name:'Guest',local:1,current:1,overallTotalXp:2000,speed:10,speedXP:10,speedUpgrades:1,speedOverdrive:0,speedPrestige:0},
 {id:91,name:'Other',local:0,current:0,overallTotalXp:200000,speed:43,speedXP:10,speedUpgrades:2,speedOverdrive:0,speedPrestige:0}
];
const rows=items=>[{columns:Object.keys(items[0]),values:items.map(x=>Object.values(x))}];
globalThis.document={
 getElementById:()=>null,
 createElement:()=>({
  dataset:{},classList:{contains:()=>false,toggle(){}},
  attachShadow(){
   this.shadowRoot={
    innerHTML:'',
    addEventListener(n,h){handlers[n]=h;},
    querySelector(sel){return sel==='#contents'?contents:{classList:{add(){},toggle(){}}};},
    querySelectorAll(){return [];}
   };
   return this.shadowRoot;
  },
  remove(){}
 }),
 body:{appendChild(){}}
};
window.db={read:async fn=>fn({exec(sql){if(sql.startsWith('SELECT * FROM character'))return rows(characters);if(sql.includes('FROM score'))return rows([{characterId:42}]);throw Error('Unknown SQL');}})};
const calls=[];
globalThis.fetch=async (url,opts)=>{
 calls.push({url,opts});
 if(url.includes('/42/'))return {ok:true,json:async()=>({held:[{id:'pass-1'},{id:'speed-100'},{id:'grade-xx'},{id:'unknown-future'}]})};
 if(url.includes('/91/'))return {ok:false,status:503,json:async()=>({})};
 throw Error('Bad route');
};
mod.mount();
assert(contents.innerHTML.includes('Use current player stats'));
assert(!contents.innerHTML.includes('data-key="bronze"')||contents.innerHTML.includes('medalManual'));
function click(action){handlers.click({target:{closest:()=>({dataset:{action},classList:{contains:()=>false}})},stopPropagation(){}});}
function changePlayer(field,value){handlers.change({target:{dataset:{player:field},value},stopPropagation(){}});}
async function settle(){for(let i=0;i<25;i++)await Promise.resolve();}
click('load-stats');await settle();
assert.equal(playerState.status,'ready');assert.equal(playerState.medalStatus,'ready');
assert.equal(playerState.medalUnknown,1);assert.equal(mod.data.bronze,1);assert.equal(mod.data.gold,1);assert.equal(mod.data.divine,1);
assert.equal(calls.length,1);assert.equal(calls[0].opts.credentials,'omit');
assert.equal(calls[0].opts.method,'GET');assert(calls[0].url.endsWith('/v1/characters/42/medals'));
handlers.click({target:{closest:()=>({dataset:{tab:'Overdrive'},classList:{contains:()=>false}})},stopPropagation(){}});assert(contents.innerHTML.includes('Auto-synced for'));
changePlayer('character','91');click('load-stats');await settle();
assert.equal(playerState.medalStatus,'error');assert.equal(mod.data.bronze,0);assert.equal(mod.data.gold,0);
changePlayer('character','-1');click('load-stats');await settle();
assert.equal(playerState.medalStatus,'offline');assert.equal(calls.length,2);assert.equal(mod.data.divine,0);
const start=contents.innerHTML;
click('load-stats');await settle();assert.equal(playerState.medalStatus,'offline');
mod.unmount();
console.log('PASS: official medal ID catalogue, tier counting, auto-fetch, offline fallback, error isolation, compact UI');
