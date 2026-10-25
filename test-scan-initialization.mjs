import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withTimeout as actualTimeout} from './src/scanGuard.js';
import {createChartCache,createLimiter} from './src/scanCache.js';
import {activeModModes,refineBudget,eligibleRefineRows,combineRefinementJobs} from './src/scanStrategy.js';
const never=()=>new Promise(()=>{});
assert.equal(await actualTimeout('fast work',500,()=>Promise.resolve(4)),4);
await assert.rejects(actualTimeout('stalled',20,never),/stalled timed out/);
let aborted=false;
await assert.rejects(actualTimeout('abortable',20,signal=>{signal.addEventListener('abort',()=>aborted=true);return never()}),/abortable timed out/);
assert(aborted,'timeout aborts a cancellable network operation');
const source=(await readFile('src/smartFarm.js','utf8')).replace(/^import .*;\n/gm,'');
const flags={db:false,medal:false,catalog:false,library:false};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.window={};
const char={id:14,local:false,speedUpgrades:0};
const scopes={
 gameDb:{ready:async()=>flags.db?never():undefined},
 gameCharacter:{live:async()=>char},
 recentPlayCounts:async()=>new Map(),
 medalMultiplier:async()=>flags.medal?never():1.25,
 rankedDifficulties:async()=>flags.catalog?never():new Set([401]),
 collectCharts:async()=>flags.library?never():{requests:[{setId:42,beatmapId:401}]},
 ratesFor:()=>[1],screenRates:()=>[1],
 runSweep:async()=>({cancel(){},finished:Promise.resolve({cancelled:false,results:[{setId:42,beatmapId:401,rate:1,mod:'NM',xp:{speed:100},durationSec:60,failRate:0}]})}),
 rankMaps:()=>[],refinePlan:()=>[],optimizeFarm:({mod})=>({mod,rotation:[],expectedPerMinute:0,fatigueAfter:0}),
};
Object.assign(globalThis,scopes);
const prelude=[
 "const FARM_SKILLS=['speed','accuracy'];const MAX_TIERS=30,MAX_OD=1000000;",
 "const makePolicies=keys=>Object.fromEntries(keys.map(k=>[k,{enabled:false,targets:Array(30).fill(0)}]));",
 "const {gameDb,gameCharacter,recentPlayCounts,medalMultiplier,rankedDifficulties,collectCharts,ratesFor,screenRates,runSweep,rankMaps,refinePlan,optimizeFarm}=globalThis;",
 "const PLAYS_PER_MAP=6;const withTimeout=(label,ms,cb)=>globalThis.__bounded(label,Math.min(ms,35),cb);"+
 "const gpuScorer=globalThis.__gpuScorer,hybridRefineCandidates=globalThis.__hybridRefineCandidates;const createChartCache=globalThis.__createChartCache,createLimiter=globalThis.__createLimiter,activeModModes=globalThis.__activeModModes,refineBudget=globalThis.__refineBudget,eligibleRefineRows=globalThis.__eligibleRefineRows,combineRefinementJobs=globalThis.__combineRefinementJobs;"
].join('\n');
globalThis.__bounded=actualTimeout;globalThis.__gpuScorer=async()=>{throw Error('WebGPU disabled in test Electron')};globalThis.__hybridRefineCandidates=async()=>{throw Error('not expected')};
Object.assign(globalThis,{__createChartCache:createChartCache,__createLimiter:createLimiter,__activeModModes:activeModModes,__refineBudget:refineBudget,__eligibleRefineRows:eligibleRefineRows,__combineRefinementJobs:combineRefinementJobs});
const {SmartFarm}=await import('data:text/javascript;base64,'+Buffer.from(prelude+'\n'+source).toString('base64'));
const fresh=()=>{const f=new SmartFarm();f.root={};return f;};
flags.medal=true;
let farm=fresh();await farm.scan();
assert(!farm.scanning);
assert.equal(farm.error,'');
assert(farm.progress.startsWith('Ready'),'the scan continues after stalled medal lookup');
assert(farm.scanWarning.includes('Medal bonuses'));
assert.equal(farm.medals,1,'safe fallback medal multiplier');
flags.medal=false;
flags.db=true;
farm=fresh();await farm.scan();
assert(!farm.scanning);
assert(farm.progress.includes('Opening game character database'),'database phase remains visible on error');
assert(farm.error.includes('Game database timed out'));
flags.db=false;
flags.catalog=true;
farm=fresh();await farm.scan();
assert(farm.progress.includes('Fetching ranked map catalog'));
assert(farm.error.includes('Ranked map catalog timed out'));
flags.catalog=false;
flags.library=true;
farm=fresh();await farm.scan();
assert(farm.progress.includes('Reading downloaded map metadata'));
assert(farm.error.includes('Downloaded map library timed out'));
flags.library=false;
farm=fresh();farm.s.gpuAssist=true;await farm.scan();assert(!farm.scanning&&!farm.error&&farm.progress.startsWith('Ready'));assert(farm.gpuReport.includes('CPU fallback'),'unsupported WebGPU must not interrupt XP map scanning');
console.log('PASS: phase-by-phase scan; timeout identifies DB/catalog/library; stalled medal API degrades instead of blocking');
