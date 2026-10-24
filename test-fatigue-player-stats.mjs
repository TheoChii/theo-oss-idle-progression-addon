import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const js=await fs.readFile(new URL('./progression-toolkit.addon.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(js+'\nexport { fatigueLevel, fatigueXP, restedMinutes, strainedMinutes, afterFatigue, farmXP, farmProjection, levelFromTotal, realLevel, playerState, data, xpAt, xp };').toString('base64'));
const {fatigueLevel,fatigueXP,restedMinutes,strainedMinutes,afterFatigue,farmXP,farmProjection,levelFromTotal,realLevel,xpAt,xp}=mod;
const approx=(actual,expected)=>assert(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),actual+' != '+expected);
approx(fatigueLevel(0),0);approx(fatigueLevel(300),0);approx(fatigueLevel(360),.5);approx(fatigueLevel(420),1);approx(fatigueLevel(9999),1);
approx(fatigueXP(300),1);approx(fatigueXP(360),.525);approx(fatigueXP(420),.05);
approx(restedMinutes(320,50),300);
approx(strainedMinutes(5,40),5);approx(strainedMinutes(5,20),2.5);approx(strainedMinutes(5,100),5);
approx(afterFatigue(300,5,0),298);approx(afterFatigue(300,5,20),301.5);approx(afterFatigue(419,5,40),420);
const p=farmXP(1000,300,500,.25,420,2);
approx(p.physical,100);approx(p.memory,600);approx(p.affected,250);
assert(farmProjection(50,300,4,40,0,1000,0,0,0,1).at(-1)[2]<farmProjection(50,0,4,40,0,1000,0,0,0,1).at(-1)[2]);

const listeners={},contents={innerHTML:''},hosts=[];let writes=0;
const chars=[
 {id:100,name:'Player <one>',local:0,current:0,overallTotalXp:xpAt(108.5),
  speed:100,speedXP:xp(100)*.25,speedUpgrades:9,speedOverdrive:15,speedPrestige:2,
  stamina:75,staminaXP:xp(75)*.5,staminaUpgrades:7,staminaOverdrive:3.5,staminaPrestige:1},
 {id:-1,name:'Local guest',local:1,current:1,overallTotalXp:xpAt(42.3),
  speed:30,speedXP:xp(30)*.7,speedUpgrades:2,speedOverdrive:2,speedPrestige:0,
  stamina:18,staminaXP:xp(18)*.2,staminaUpgrades:0,staminaOverdrive:0,staminaPrestige:0}
];
const rows=x=>x.length?[{columns:Object.keys(x[0]),values:x.map(o=>Object.values(o))}]:[];
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window=new EventTarget();
window.db={async read(fn){return fn({exec(sql){
 if(sql.startsWith('SELECT * FROM character'))return rows(chars);
 if(sql.startsWith('SELECT characterId FROM score'))return rows([{characterId:-1}]);
 throw Error('Unexpected SQL '+sql);
}})},async write(){writes++;throw Error('Forbidden write')}};
const shadow=()=>({innerHTML:'',addEventListener(n,fn){listeners[n]=fn},
 querySelector(s){return s==='#contents'?contents:{classList:{add(){},toggle(){}}}},
 querySelectorAll(){return []}});
globalThis.document={getElementById:()=>null,createElement:()=>({
 id:'',shadowRoot:null,dataset:{},classList:{contains:()=>false,toggle(){}},
 attachShadow(){this.shadowRoot=shadow();return this.shadowRoot},remove(){}
}),body:{appendChild(el){hosts.push(el)}}};
mod.mount();
assert(contents.innerHTML.includes('Use current player stats'));
const click=action=>listeners.click({target:{closest:()=>({dataset:{action},classList:{contains:()=>false}})},stopPropagation(){}});
const change=(type,value)=>listeners.change({target:{dataset:{player:type},value},stopPropagation(){}});
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
click('load-stats');await settle();
assert.equal(mod.playerState.status,'ready');
assert.equal(mod.playerState.characterId,100,'account character prioritized over guest');
approx(mod.data.level,100.25);approx(mod.data.overall,108.5);
assert.equal(mod.data.upgrades,9);assert.equal(mod.data.overdrive,15);assert.equal(mod.data.prestige,2);
assert(contents.innerHTML.includes('Player &lt;one&gt;'),'character display must escape HTML');
change('skill','stamina');click('load-stats');await settle();
approx(mod.data.level,75.5);assert.equal(mod.data.upgrades,7);approx(mod.data.overdrive,3.5);
change('character','-1');click('load-stats');await settle();
approx(mod.data.level,18.2);approx(mod.data.overall,42.3);
assert.equal(mod.data.prestige,0);assert.equal(writes,0,'read-only DB');
mod.unmount();
console.log('PASS: official fatigue breakpoints, XP floor, recovery, projection and read-only current player/skill snapshot');
