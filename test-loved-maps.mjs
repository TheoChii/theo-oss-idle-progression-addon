import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseMapEligibility,filterBestPP} from './src/mapEligibility.js';
const catalog={
 intro:{id:0},
 beatmaps:[
  {id:0,ranked:true,loved:false,versions:[{id:9}]},
  {id:100,ranked:true,loved:false,versions:[{id:101},{id:102}]},
  {id:200,ranked:true,loved:true,versions:[{id:201},{id:202}]},
  {id:300,ranked:true,status:'loved',versions:[{id:301}]},
  {id:400,ranked:true,versions:[{id:401}]},
  {id:500,ranked:true,loved:false,versions:[{id:102},{id:502}]}
 ]};
const c=parseMapEligibility(catalog);
assert.deepEqual([...c.xp].sort((a,b)=>a-b),[101,102,201,202,301,401,502]);
assert.deepEqual([...c.pp].sort((a,b)=>a-b),[101,102,401,502]);
assert.deepEqual([...c.loved].sort((a,b)=>a-b),[201,202,301]);
assert(!c.xp.has(9),'intro never counts');
assert(c.xp.has(201)&&!c.pp.has(201),'loved approved map gives XP only');
assert(!c.pp.has(202),'do not mistake ranked=true (approved) for PP');
assert.throws(()=>parseMapEligibility({}),/Unexpected beatmap catalog/);
const oldScores=new Map([[101,125],[201,160],[301,210],[102,88],[999,520]]);
assert.deepEqual([...filterBestPP(oldScores,c.pp)],[ [101,125],[102,88] ],
 'historical Loved/unranked local scores should not inflate total PP');
const safety=(await readFile('src/farm/safety.js','utf8')).replace(/^export /gm,'');
const source=safety+(await readFile('src/smartFarm.js','utf8')).replace(/^import .*;\n/gm,'');
const seen={collect:[],runs:[]};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.window={};
const char={id:14,local:false,speedUpgrades:0};
const scopes={
 gameDb:{ready:async()=>{}},
 gameCharacter:{live:async()=>char},
 recentPlayCounts:async()=>new Map(),
 medalMultiplier:async()=>1.1,
 catalogDifficulties:async()=>c,
 collectCharts:async eligible=>{
  seen.collect.push([...eligible].sort((a,b)=>a-b));
  return {requests:[...eligible].map(beatmapId=>({setId:beatmapId,beatmapId}))};
 },
 ratesFor:()=>[1],screenRates:()=>[1],
 runSweep:async(requests,opts)=>{
  seen.runs.push({ids:requests.map(x=>x.beatmapId),opts});
  return {cancel(){},finished:Promise.resolve({cancelled:false,
   results:requests.map(x=>({setId:x.setId,beatmapId:x.beatmapId,rate:1,mod:'NM',
    xp:{speed:100},pp:200,durationSec:60,failRate:0}))})};
 },
 rankMaps:()=>[],refinePlan:()=>[],
 optimizeFarm:({mod})=>({mod,rotation:[],expectedPerMinute:0,fatigueAfter:0}),
 optimizePP:({mod,results})=>({mod,rotation:results.slice(0,1).map(x=>({...x,ppGain:0,expectedPP:0})),
  expectedPPGain:0,expectedPPGainPerMinute:0}),
 readBestPP:async()=>({best:new Map(oldScores),source:'test local cache',fetched:true}),
};
Object.assign(globalThis,scopes);
const prelude=[
 "const FARM_SKILLS=['speed','accuracy'];const MAX_TIERS=30,MAX_OD=1000000;",
 "const makePolicies=keys=>Object.fromEntries(keys.map(k=>[k,{enabled:false,targets:Array(30).fill(0)}]));",
 "const {gameDb,gameCharacter,recentPlayCounts,medalMultiplier,catalogDifficulties,collectCharts,ratesFor,screenRates,runSweep,rankMaps,refinePlan,optimizeFarm,optimizePP,readBestPP}=globalThis;",
 "const filterBestPP=globalThis.__filterBestPP;",
 "const createChartCache=()=>({clear(){},stats:{hits:0}}),createLimiter=()=>f=>f();",
 "const activeModModes=()=>['NM'],refineBudget=()=>10,eligibleRefineRows=()=>[],combineRefinementJobs=()=>[];",
 "const withTimeout=(label,ms,fn)=>fn(),PLAYS_PER_MAP=5;"
].join('\n');
globalThis.__filterBestPP=filterBestPP;
const {SmartFarm}=await import('data:text/javascript;base64,'+Buffer.from(prelude+'\n'+source).toString('base64'));
const xp=new SmartFarm();xp.root={};
await xp.scan();
assert.equal(xp.error,'');
assert(xp.progress.startsWith('Ready'),'xp scan finished');
assert.deepEqual(seen.collect[0],[101,102,201,202,301,401,502]);
assert.equal(xp.lovedIds.size,3);
assert(xp.progress.includes('Loved XP'));
const pp=new SmartFarm();pp.root={};pp.s.goal='pp';
await pp.scan();
assert.equal(pp.error,'');
assert(pp.progress.startsWith('Ready'),'pp scan finished');
assert.deepEqual(seen.collect[1],[101,102,401,502],'PP mode screens ranked maps only');
assert.deepEqual([...pp.ppHistory.best.keys()],[101,102],'local PP cache excludes loved even when old score says 200 PP');
assert(!seen.runs[1].ids.includes(201),'no PP simulation on Loved map');
assert(!pp.lovedIds.has(101));
console.log('PASS: 1.2.6.0 approved=Ranked+Loved XP, Ranked-only PP, historical PP cleanup and full XP/PP scan integration');
