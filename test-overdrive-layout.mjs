import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source=await fs.readFile(new URL('./progression-toolkit.addon.js',import.meta.url),'utf8');
let saved={};
const hosts=[];
const content={innerHTML:''};
const listeners={};
const shadow=()=>({
  innerHTML:'',
  addEventListener(name,fn){listeners[name]=fn;},
  querySelector(selector) {
    if(selector==='#contents')return content;
    return {classList:{add(){},toggle(){}}};
  },
  querySelectorAll(){return []}
});
globalThis.localStorage={
  getItem:()=>JSON.stringify(saved),
  setItem:()=>{}
};
globalThis.window=new EventTarget();
globalThis.document={
  getElementById:()=>null,
  createElement:()=>({
    shadowRoot:null,dataset:{},classList:{contains:()=>false,toggle(){}},
    attachShadow(){this.shadowRoot=shadow();return this.shadowRoot},
    remove(){}
  }),
  body:{appendChild(el){hosts.push(el)}}
};
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function checkCase(label,input,expected,absent=[]){
  saved=input;
  mod.mount();
  listeners.click({target:{closest:()=>({classList:{contains:()=>false},dataset:{tab:'Overdrive'}})},stopPropagation(){}});
  const html=content.innerHTML;
  const match=html.match(/<div class="grid">((?:<div class="metric"><small>[^<]*<\/small><b>[^<]*<\/b><small>[^<]*<\/small><\/div>){4})<\/div>/);
  assert(match,label+': expected a complete four-card status grid, no empty cell');
  const labels=[...match[1].matchAll(/<small>([^<]*)<\/small><b>/g)].map(m=>m[1]);
  assert.equal(labels.length,4,label+': exactly four card labels');
  for(const t of expected) assert(html.includes(t),label+': expected '+t);
  for(const t of absent) assert(!html.includes(t),label+': should not include '+t);
  console.log(label+': '+labels.join(' | '));
  mod.unmount();
}
checkCase('locked upgrade',{level:90,upgrades:9,overdrive:15,prestige:1,xpPlay:30000,buyAt:100.25},['XP to unlock','Plays to unlock','Available at Lv100'],['Overdrive if bought now']);
checkCase('unlocked upgrade',{level:100.25,upgrades:9,overdrive:15,prestige:1,xpPlay:30000,buyAt:100.25},['Upgrade unlocked','Overdrive if bought now','READY','At your current level'],['Plays to unlock']);
checkCase('at exact unlock',{level:100,upgrades:9,overdrive:0,prestige:1,xpPlay:30000,buyAt:100},['Upgrade unlocked','+0σ'],['Plays to unlock']);
checkCase('maxed slots',{level:120,upgrades:11,overdrive:50,prestige:1,xpPlay:30000,buyAt:121},['All filled','Next extra slot','Prestige 2'],['Overdrive if bought now','Plays to unlock']);
console.log('PASS: Overdrive 2x2 status grid for locked, eligible, exact-level and maxed cases.');
