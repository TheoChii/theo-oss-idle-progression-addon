import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PHYSICAL,BLOCKED,findTargets} from './src/optimizer.js';
const config=JSON.parse(await readFile('addon.config.json','utf8'));
const pkg=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const game=JSON.parse(await readFile('node_modules/oss-idle/package.json','utf8'));
assert.equal(config.gameVersion,'1.2.5.0');
assert.equal(game.version,'1.2.5.0');
assert(pkg.dependencies['oss-idle'].endsWith('/7ebe02c6a98a4f9aaeb4a923aacbe6e5dae4e3ff'));
assert.equal(lock.packages['node_modules/oss-idle'].version,'1.2.5.0');
assert.equal(lock.packages['node_modules/oss-idle'].resolved,pkg.dependencies['oss-idle']);
const skills=await readFile('node_modules/oss-idle/packages/shared/src/skills.ts','utf8');
const grouping=skills.split('export const PHYSICAL_SKILLS: SkillName[] = [')[1]?.split('];')[0];
assert(grouping);
for(const skill of ['speed','stamina','jackspeed','coordination']) {
 assert(grouping.includes('SKILL.'+skill),skill+' is physical in pinned game');
 assert(PHYSICAL.has(skill),skill+' is physical in optimizer');
 assert(!BLOCKED.has(skill),skill+' is exempt from Mindblock');
}
assert.equal(findTargets({},'coordination','accuracy',420,.1).target,'accuracy','Coordination fatigue triggers fallback');
const fatigue=await readFile('node_modules/oss-idle/packages/shared/src/fatigue.ts','utf8');
assert(fatigue.includes('const ONSET_MINUTES = 5 * 60'));
assert(fatigue.includes('const FULL_MINUTES = 7 * 60'));
assert(fatigue.includes('const XP_FLOOR = 0.05'));
const worker=await readFile('src/engine/sim.worker.ts','utf8');
assert(worker.includes("import { tiredSkills, fatigueLevel, warmup } from '@oss-idle/shared/fatigue'"));
console.log('PASS: pinned official v1.2.5.0, Coordination physical & no Mindblock, matching fatigue curve and worker model');
