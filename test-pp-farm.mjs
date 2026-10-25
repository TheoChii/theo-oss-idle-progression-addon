import assert from 'node:assert/strict';
import {optimizePP, weightedPP, normalizeBestPP} from './src/ppFarm.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,a+' != '+b);
near(weightedPP(new Map([[1,100],[2,90]])),185.5);
assert.deepEqual([...normalizeBestPP([{beatmapId:1,pp:40},{beatmapId:1,pp:60},{beatmapId:2,pp:-10}])],[ [1,60] ]);
const baseline=new Map([[1,100],[2,90]]);
const maps=[
 {beatmapId:1,rate:1,mod:'NM',pp:105,durationSec:60,failRate:0.1},
 {beatmapId:1,rate:1.2,mod:'NM',pp:140,durationSec:68,failRate:0.1},
 {beatmapId:3,rate:1,mod:'NM',pp:120,durationSec:50,failRate:0.1},
 {beatmapId:3,rate:1.4,mod:'NM',pp:130,durationSec:50,failRate:0.1},
 {beatmapId:4,rate:1,mod:'NM',pp:85,durationSec:40,failRate:0.1},
 {beatmapId:5,rate:1,mod:'NM',pp:500,durationSec:40,failRate:0.8},
 {beatmapId:3,rate:1.4,mod:'HR',pp:190,durationSec:50,failRate:0.1},
 {beatmapId:1,rate:1.1,mod:'HR',pp:115,durationSec:45,failRate:0.1},
];
const result=optimizePP({results:maps,bestPP:baseline,mod:'NM',slots:4,scoreMode:'gain'});
assert.equal(result.goal,'pp');
assert.equal(result.mod,'NM');
assert.equal(result.rotation[0].beatmapId,3);
assert.equal(result.rotation[0].rate,1.4);
assert.equal(new Set(result.rotation.map(x=>x.beatmapId)).size,result.rotation.length,'one PP best per difficulty');
assert(!result.rotation.some(x=>x.beatmapId===5),'avoid frequent failures');
assert(!result.rotation.some(x=>x.mod==='HR'),'avoid mixing mods');
near(result.expectedPP-result.currentPP,result.expectedPPGain);
assert(result.rotation.every(x=>x.previousPP>=0&&x.ppGain>0),'only improvements');
const used=new Map(baseline);for(const x of result.rotation)used.set(x.beatmapId,x.expectedPP);
near(result.expectedPP,weightedPP(used));
const hr=optimizePP({results:maps,bestPP:baseline,mod:'HR',slots:4});
assert(hr.expectedPPGain>0&&hr.rotation.every(x=>x.mod==='HR'));
const tiny=optimizePP({results:[{beatmapId:1,mod:'NM',rate:1,pp:100.01,durationSec:60,failRate:0}],bestPP:baseline,minGain:.1});
assert.equal(tiny.rotation.length,0,'skip insignificant gains');
const oldBest=new Map([[3,200],[1,160],[2,90]]);
const noImprovement=optimizePP({results:maps.filter(x=>x.mod==='NM'),bestPP:oldBest,mod:'NM',slots:4});
assert(!noImprovement.rotation.some(x=>x.beatmapId===3||x.beatmapId===1),'drop no-longer-profitable maps after PB');
const faster=optimizePP({results:[{beatmapId:10,mod:'NM',pp:80,durationSec:30,rate:1,failRate:0},{beatmapId:11,mod:'NM',pp:90,durationSec:180,rate:1,failRate:0}],bestPP:new Map(),slots:1,scoreMode:'gainPerMinute'});
assert.equal(faster.rotation[0].beatmapId,10,'per-minute strategy favors shorter improvements');
const bigger=optimizePP({results:[{beatmapId:10,mod:'NM',pp:80,durationSec:30,rate:1,failRate:0},{beatmapId:11,mod:'NM',pp:90,durationSec:180,rate:1,failRate:0}],bestPP:new Map(),slots:1,scoreMode:'gain'});
assert.equal(bigger.rotation[0].beatmapId,11,'raw PP strategy favors largest PP gain');
const {readFile}=await import('node:fs/promises');
const [farm,worker,pp]=await Promise.all(['src/smartFarm.js','src/engine/sim.worker.ts','src/engine/pp.ts'].map(x=>readFile(x,'utf8')));
assert(farm.includes("if(this.s.goal==='pp')return [{kind:'pp'}];"));
assert(farm.includes("(k==='modPreference'&&previousMod!==this.s.modPreference)"));
assert(farm.includes("this.render();void this.scan();"));
assert(farm.includes("this.modPlans={NM:optimizePP"));
assert(worker.includes('pp.calculate(score, rate, mods)'));
assert(pp.includes("mods: mods.join('')"));
console.log('PASS: weighted 0.95 PP, existing best, per-map rate, NM/HR split, gain ranking, PB de-dup and automatic scan');
