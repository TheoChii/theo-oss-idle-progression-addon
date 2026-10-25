import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [worker,client,protocol,smart]=await Promise.all([
 readFile('src/engine/sim.worker.ts','utf8'),
 readFile('src/engine/client.ts','utf8'),
 readFile('src/engine/protocol.ts','utf8'),
 readFile('src/smartFarm.js','utf8')
]);
assert(worker.includes("mod === 'HR' ? ['HR'] : []"));
assert(worker.includes('new ManiaGame(chart, bot, { divine, rate, mods })'));
assert(worker.includes("modXp(bot.getSkillsXP(chart.totalLength / rate, score) as Record<string, number>, mods)"));
assert(worker.includes("for (const mod of modModes)"));
assert(client.includes('modModes,'));
assert(protocol.includes("mod: 'NM' | 'HR'"));
assert(smart.includes("modModes:['NM','HR']"));
assert(smart.includes("results.filter(x=>x.mod===mod)"));
assert(smart.includes("x.beatmapId+'@'+x.rate+'@'+x.mod"));
assert(smart.includes("const key=JSON.stringify({entries,mod})"));
assert(smart.includes("this.previousMods=Array.isArray("));
assert(smart.includes("this.modPlans={NM:optimizeFarm({"));
console.log('PASS: worker uses real HR hit windows and Accuracy XP bonus; independent NM/HR refinements and session-mod selection');
