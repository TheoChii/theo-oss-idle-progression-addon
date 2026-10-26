import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WORST_CASE_FATIGUE_MINUTES,SAFETY_REFINEMENT_RUNS,safeRefinedRows,canPublishSafePlan} from './src/farm/safety.js';

const base={beatmapId:1001,rate:1,mod:'NM',failRate:0,durationSec:80,xp:{accuracy:500}};
assert.equal(WORST_CASE_FATIGUE_MINUTES,420);
assert(SAFETY_REFINEMENT_RUNS>=16);
assert.deepEqual(safeRefinedRows([base],{fatigueMinutes:0,runs:16}),[]);
assert.deepEqual(safeRefinedRows([base],{fatigueMinutes:420,runs:1}),[]);
assert.deepEqual(safeRefinedRows([base],{fatigueMinutes:420,runs:3}),[]);
const verified=safeRefinedRows([
 base,{...base,beatmapId:1002,failRate:0.0625},
 {...base,beatmapId:1003,failRate:1},
 {...base,beatmapId:1004,durationSec:0},
],{fatigueMinutes:420,runs:16});
assert.deepEqual(verified.map(x=>x.beatmapId),[1001]);
assert(verified[0].isRefined);
assert(canPublishSafePlan({rotation:verified},verified));
assert(!canPublishSafePlan({rotation:[{...base,isRefined:false}]},verified));
assert(!canPublishSafePlan({rotation:[{...base,isRefined:true,failRate:.0625}]},verified));
assert(!canPublishSafePlan({rotation:[]},verified));
const source=await readFile('./src/smartFarm.js','utf8');
assert(source.includes('this.s.fatigueMinutes=WORST_CASE_FATIGUE_MINUTES'),'persisted old 0-minute setting must be overridden');
assert(source.includes('results=safeRefinedRows(refined'),'only safety-refined rows can be ranked');
assert(source.includes('this.safetyReady=false;const my=++this.session'),'old live results invalidated on every scan');
assert(source.includes('this.stopLive(true)'),'owned unsafe playlist must be cleared when no safe maps exist');
assert(source.includes('if(!this.safetyReady||!canPublishSafePlan(this.plan,this.results))'),'live writes require safe plan');
console.log('PASS: worst-case fatigue, 16-run zero-fail admission, old-settings override and queue publish guard');
