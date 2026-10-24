import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const js=await fs.readFile(new URL('./progression-toolkit.addon.js',import.meta.url),'utf8');
const handlers={};
const contents={innerHTML:''};
const results={innerHTML:''};
const controls=[];
let mounted,sectionClicks=0,dbWrites=0,versionUsed='unknown',idbMode='';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window=new EventTarget();
const chars=[
 {id:11,name:'First <account>',local:0,current:0,overallTotalXp:5000},
 {id:22,name:'Alt & local',local:1,current:1,overallTotalXp:100}
];
const savedScores=new Map([[11,new Map([[100,2]])],[22,new Map([[200,1]])]]);
const data=[
 {id:1,title:'Played <Song>',artist:'Alice & Bob',versions:[
   {id:100,version:'4K HD',difficulty:2.2,keys:4,mode:3,objects:707},
   {id:101,version:'4K MX',difficulty:3.6,keys:4,mode:3,objects:727}
 ]},
 {id:2,title:'Never Played',artist:'Artist',versions:[
   {id:200,version:'Normal',difficulty:1.7,keys:7,mode:3,objects:500},
   {id:300,version:'High <difficulty>',difficulty:5.5,keys:4,mode:3,objects:850},
   {id:400,version:'Standard',difficulty:2,keys:4,mode:0,objects:400}
 ]}
];
const recordset=rows=>rows.length? [{columns:Object.keys(rows[0]),values:rows.map(x=>Object.values(x))}]:[];
window.db={
 async read(fn){
  const wrapped={exec:(sql,params=[])=>{
   if(sql.startsWith('SELECT id, name, local'))return recordset(chars);
   if(sql.startsWith('SELECT characterId'))return recordset([{characterId:11}]);
   if(sql.startsWith('SELECT beatmapId')){
    return recordset([...(savedScores.get(params[0])||new Map())].map(([beatmapId,plays])=>({beatmapId,plays})));
   }
   throw new Error('Unexpected query '+sql);
  }};
  return fn(wrapped);
 },
 async write(){dbWrites++;throw Error('Game must not be mutated');}
};
const objectStoreNames={contains:s=>s==='meta'};
globalThis.indexedDB={
 open(name,version){
  assert.equal(name,'beatmaps');
  versionUsed=version;
  const req={};
  queueMicrotask(()=>{
   const db={
    objectStoreNames,
    close(){},
    transaction(store,mode){
     assert.equal(store,'meta');idbMode=mode;
     const tx={};
     tx.objectStore=()=>({getAll(){
      const get={};
      queueMicrotask(()=>{get.result=data;get.onsuccess?.();tx.oncomplete?.();});
      return get;
     }});
     return tx;
    }
   };
   req.result=db;req.onsuccess?.();
  });
  return req;
 }
};
const mockShadow=()=>({
 innerHTML:'',
 addEventListener:(name,fn)=>{handlers[name]=fn;},
 querySelector:(selector)=>selector==='#contents'?contents:selector==='#map-results'?results:{classList:{add(){},toggle(){}}},
 querySelectorAll:()=>controls
});
globalThis.document={
 getElementById:()=>null,
 createElement:()=>({
  dataset:{},shadowRoot:null,
  classList:{flags:new Set(),remove(){},toggle(){}},
  attachShadow(){this.shadowRoot=mockShadow();return this.shadowRoot},
  remove(){}
 }),
 body:{appendChild(el){mounted=el}}
};
const mod=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const click=dataset=>handlers.click({target:{closest:()=>({dataset,classList:{contains:()=>false}})},stopPropagation(){}});
const changed=(field,value)=>handlers.change({target:{dataset:{mapFilter:field},value,checked:value===true},stopPropagation(){}});
const input=(value)=>handlers.input({target:{dataset:{mapFilter:'query'},value},stopPropagation(){}});
const settled=async()=>{for(let i=0;i<15;i++)await Promise.resolve()};
mod.mount();
assert(contents.innerHTML.includes('All 11 skills'),'calculator default must remain intact');
click({section:'Discovery'});
await settled();
assert.equal(mounted.dataset.section,'discovery');
assert(contents.innerHTML.includes('Checking'),'results loaded');
assert(contents.innerHTML.includes('First &lt;account&gt;'),'character XSS escaped');
assert.equal(versionUsed,undefined,'must not specify an IDB schema version');
assert.equal(idbMode,'readonly','must read IDB without a write transaction');
assert(results.innerHTML.includes('Never Played'));
assert(!contents.innerHTML.includes('data-map-filter=\"keys\"'),'No redundant key selector');
assert(!results.innerHTML.includes('7K'),'Only 4K charts returned');
assert(results.innerHTML.includes('4K MX'),'second difficulty is unplayed even if set was played');
assert(!results.innerHTML.includes('Played &lt;Song&gt;</b><small>Alice &amp; Bob • 4K HD'),'played chart should be excluded');
assert(!results.innerHTML.includes('Standard'),'non-mania mode excluded');
assert(results.innerHTML.includes('https://osu.ppy.sh/beatmaps/101'));
assert(!results.innerHTML.includes('<Song>'),'title must be HTML escaped');
changed('character','22');
await settled();
assert(!results.innerHTML.includes('Never Played</b><small>Artist • Normal'),'alt character has played map 200 difficulty');
assert(results.innerHTML.includes('4K HD'),'alt character has not played map 100');
changed('limit','3');
assert(!results.innerHTML.includes('4K MX'),'star cap filters 3.6-star chart');
input('Played');
assert(results.innerHTML.includes('Played &lt;Song&gt;'),'search should match underlying unescaped title');
input('no-match');
assert(results.innerHTML.includes('No downloaded maps matched'));
changed('unplayed',false);
assert(results.innerHTML.includes('No downloaded maps matched'),'search still applies');
input('');
assert(results.innerHTML.includes('Played &lt;Song&gt;'),'matching views update');
click({action:'refresh-maps'});
await settled();
assert(contents.innerHTML.includes('Checking'),'refresh should restore ready view');
assert.equal(dbWrites,0);
click({section:'Calculators'});
assert.equal(mounted.dataset.section,'calculators');
assert(contents.innerHTML.includes('All 11 skills'));
mod.unmount();
console.log('PASS: two sections, read-only database and IndexedDB, character switch, local history, search, stars, mode, input safety, refresh, calculators');
