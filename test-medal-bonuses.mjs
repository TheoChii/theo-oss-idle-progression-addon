import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('./progression-toolkit.addon.js', import.meta.url), 'utf8');
assert(source.includes('v0.5.3'));
assert(source.includes("['Calculators','Discovery','Friends']"), 'Discovery and Friends sections must be retained');
const mod = await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport { MEDAL_RATES, medals, boost, preview, xpAt, to, cb };').toString('base64'));
const { MEDAL_RATES, medals, boost, preview, xpAt, to, cb } = mod;
assert.deepEqual(MEDAL_RATES, {bronze:.0025,silver:.005,gold:.01,platinum:.02,divine:.03});
const approx=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-9*Math.max(1,Math.abs(expected)),label+': '+actual+' != '+expected);
approx(medals({}),1,'no medals');
approx(medals({bronze:4,silver:3,gold:2,platinum:1,divine:5}),1.0025**4*1.005**3*1.01**2*1.02*1.03**5,'compound');
approx(medals({bronze:-5,silver:2.9}),1.005**2,'clamp and floor');
const counts={bronze:4,silver:2,gold:3,platinum:1,divine:1};
const m=medals(counts);
approx(boost(0,99,0,m),m,'zero upgrades still gives medal XP');
approx(boost(9,15,1,m),boost(9,15,1)*m,'medals apply after upgrades/prestige');
const a=preview(100.25,9,15,1),b=preview(100.25,9,15,1,m);
assert(a&&b);
approx(a.add,b.add,'raw overdrive not modified by medals');
approx(b.newBoost,a.newBoost*m,'post-purchase includes medals');

const handlers={},contents={innerHTML:''},roots=[];
globalThis.localStorage={getItem:()=>JSON.stringify({level:90,upgrades:9,overdrive:15,prestige:1,xpPlay:30000,totalXpPlay:90000,overall:100.13,exempt:30000,affected:10000,repeats:10,...counts}),setItem(){}};
globalThis.window=new EventTarget();
globalThis.document={
 getElementById:()=>null,
 createElement:()=>({
  shadowRoot:null,dataset:{},classList:{contains:()=>false,toggle(){}},
  attachShadow(){this.shadowRoot={
    innerHTML:'',addEventListener:(name,handler)=>{handlers[name]=handler},
    querySelector:selector=>selector==='#contents'?contents:{classList:{add(){},toggle(){}}},
    querySelectorAll:()=>[]
  };return this.shadowRoot},remove(){}
 }),
 body:{appendChild:el=>roots.push(el)}
};
mod.mount();
function tab(name){
 handlers.click({target:{closest:()=>({dataset:{tab:name},classList:{contains:()=>false}})},stopPropagation(){}});
 return contents.innerHTML;
}
function metric(name){
 const pattern='<small>'+name+'</small><b>';
 const value=contents.innerHTML.split(pattern)[1]?.split('</b>')[0];
 assert(value!==undefined,'Missing metric '+name);
 return Number(value.replaceAll(',','').replaceAll('×',''));
}
function expectedDisplay(v,d=4){return Number(v.toLocaleString('en-US',{maximumFractionDigits:d}).replaceAll(',',''));}
let html=tab('Overdrive');
assert(html.includes('Bronze medals')&&html.includes('Divine medals'));
assert(html.includes('🏅 Medals '+m.toLocaleString('en-US',{maximumFractionDigits:4})+'×'),'compact medal summary');
approx(metric('Current multiplier'),expectedDisplay(boost(9,15,1,m)),'overdrive multiplier display');
assert.equal(metric('Plays to unlock'),Math.ceil((xpAt(100)-xpAt(90))/(30000*boost(9,15,1,m))));
assert.equal(metric('Plays to planned upgrade'),Math.ceil((xpAt(100.25)-xpAt(90))/(30000*boost(9,15,1,m))));
html=tab('Prestige');
approx(metric('Multiplier after reset'),expectedDisplay(1.1**2*m),'prestige after-reset display');
assert.equal(metric('Estimated plays'),Math.ceil((xpAt(101)-xpAt(90))/(30000*boost(9,15,1,m))));
html=tab('Rebirth');
assert.equal(metric('Estimated plays'),Math.ceil(Math.max(0,to(110)-xpAt(100.13))/(90000*m)));
html=tab('Farming');
const mind=1-.75*cb(.6,0,.6,1)(10/25);
approx(metric('Total XP / map'),expectedDisplay((30000+10000*mind)*m,0),'farming XP/play includes medals');
mod.unmount();
console.log('PASS: compounded medal XP rates, Overdrive, Prestige, Rebirth and Farming UI, Discovery preserved');
