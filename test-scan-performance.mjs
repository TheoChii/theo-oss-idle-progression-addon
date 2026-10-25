import assert from 'node:assert/strict';
import {createChartCache,mapLimit,createLimiter} from './src/scanCache.js';
import {activeModModes,refineBudget,eligibleRefineRows,combineRefinementJobs} from './src/scanStrategy.js';
assert.deepEqual(activeModModes('NM'),['NM']);
assert.deepEqual(activeModModes('HR'),['HR']);
assert.deepEqual(activeModModes('auto'),['NM','HR']);
assert.equal(refineBudget(1),8);
assert.equal(refineBudget(10),20);
assert.equal(refineBudget(60),35);
const cache=createChartCache(24);
cache.put(1,10,'aaa');
cache.put(1,11,'bbbb'); // 14 bytes
assert.equal(cache.get(1,10),'aaa');
cache.put(1,12,'123456789'); // 18 bytes, evicts 11 then 10 as needed
assert.equal(cache.get(1,11),undefined);
assert.equal(cache.get(1,10),'aaa');
assert.equal(cache.get(1,12),'123456789');
assert(cache.stats.bytes<=24);
cache.put(1,13,'x'.repeat(100));
assert.equal(cache.get(1,13),undefined,'oversize chart never retained');
cache.clear();assert.equal(cache.stats.bytes,0);
let inFlight=0,max=0;
const work=Array.from({length:13},(_,i)=>i);
const out=await mapLimit(work,4,async n=>{
 inFlight++;max=Math.max(max,inFlight);
 await new Promise(r=>setTimeout(r,2));inFlight--;return n*2;
});
assert.deepEqual(out,work.map(n=>n*2));assert(max>1&&max<=4,'IPC operations overlap at <=4');
const limiter=createLimiter(4);
let concurrent=0,peak=0;
const waits=Array.from({length:20},(_,i)=>limiter(async()=>{
 concurrent++;peak=Math.max(peak,concurrent);
 await new Promise(r=>setTimeout(r,2));concurrent--;return i;
}));
assert.deepEqual(await Promise.all(waits),Array.from({length:20},(_,i)=>i));
assert.equal(peak,4,'global limiter caps all workers to four IPC requests');
assert.equal(limiter.stats().pending,0);
const rows=[
 {beatmapId:1,rate:1,setId:1,mod:'NM',pp:110,failRate:0,durationSec:60,perSecond:3,value:180},
 {beatmapId:1,rate:1.2,setId:1,mod:'NM',pp:112,failRate:0,durationSec:60,perSecond:2,value:120},
 {beatmapId:2,rate:1,setId:2,mod:'NM',pp:125,failRate:0,durationSec:40,perSecond:1.8,value:90},
 {beatmapId:3,rate:1,setId:3,mod:'NM',pp:500,failRate:1,durationSec:50,perSecond:10,value:900},
 {beatmapId:4,rate:1,setId:4,mod:'NM',pp:30,failRate:0,durationSec:60,perSecond:.01,value:1}
];
const xp=eligibleRefineRows(rows,{goal:'xp',limit:10});
assert.deepEqual(xp.map(x=>x.beatmapId),[1,2],'XP skip weak/failing and repeated difficulties');
const pp=eligibleRefineRows(rows,{goal:'pp',bestPP:new Map([[1,300],[2,100],[4,90]]),limit:10});
assert.deepEqual(pp.map(x=>x.beatmapId),[2],'PP ranking considers existing best and fail rate');
const close=eligibleRefineRows([{...rows[0],pp:99}],{goal:'pp',bestPP:new Map([[1,100]])});
assert.equal(close.length,1,'noisy one-run margin retains near-best PP');
const jobs=combineRefinementJobs([
 {setId:1,beatmapId:99,rates:[1,1.2]},
 {setId:1,beatmapId:99,rates:[1.2,1.3]},
 {setId:2,beatmapId:100,rates:[1]}
]);
assert.deepEqual(jobs,[{setId:1,beatmapId:99,rates:[1,1.2,1.3]},{setId:2,beatmapId:100,rates:[1]}]);
console.log('PASS: mod selection, bounded 64MB-capable LRU, four-file concurrency, efficient XP/PP refinement and rate unions');
