import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const build=join(here,'build-cpu-profile.mjs');
execFileSync(process.execPath,[build],{cwd:resolve(here,'../..'),timeout:25000,stdio:'pipe'});
const stdout=execFileSync(process.execPath,
 [join(here,'.cpu-profile-run.mjs'),'--notes=128','--samples=2','--mod=NM'],
 {cwd:resolve(here,'../..'),timeout:25000,encoding:'utf8'});
const result=JSON.parse(stdout);
assert.equal(result.benchmark,'offline-CPU-only-official-game-1.2.6.0');
assert.equal(result.synthetic,true);
assert.equal(result.notes,128);assert.equal(result.samples,2);
assert.equal(result.mod,'NM');
assert.equal(result.phaseStats.botAnalyzeSkillStrains.calls,2);
assert.equal(result.phaseStats.ppPerformanceCalculate.calls,2);
assert.equal(result.phaseStats.chartDecode.calls,1);
assert.equal(result.outcomeSummary.failedPlays,0);
assert.equal(result.outcomeSummary.meanJudgedHits,128);
assert(result.outcomeSummary.meanPP>0,'rosu-pp must actually score synthetic chart');
const c=result.constructorBreakdown;
assert(c.skillStrainAnalysisMeanMs>0);
assert(c.botGenerateEventsMeanMs>=c.skillStrainAnalysisMeanMs);
assert(result.phaseStats.maniaGameConstructIncludesBotEventGeneration.meanMs>=c.botGenerateEventsMeanMs);
assert(result.perPlayTotalMeanMs>0);
const detailed=JSON.parse(execFileSync(process.execPath,
 [join(here,'.cpu-profile-run.mjs'),'--notes=128','--samples=1','--mod=NM','--skill-detail=yes'],
 {cwd:resolve(here,'../..'),timeout:25000,encoding:'utf8'}));
assert.equal(Object.keys(detailed.skillDetail).length,11,'profile all eleven official skill analyzers');
assert(detailed.skillDetail.speed.meanTotalMsPerPlay>0);
assert(detailed.skillDetail.reading.meanTotalMsPerPlay>0);
assert.equal(detailed.outcomeSummary.failedPlays,0);
console.log('PASS: offline synthetic 4K CPU profiler, real pinned simulation, XP/PP, nested phases and no failures');
