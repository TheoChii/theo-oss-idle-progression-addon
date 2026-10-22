import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const file = new URL('./progression-toolkit.addon.js',import.meta.url);
const source=await readFile(file,'utf8');
assert(source.includes("['Improvement','Overdrive'"),'Improvement tab is present');
const src=source+'\nexport { SKILL_IDS, SKILL_LABELS, gameplayLevel, skillMetrics, xpAt };';
const mod=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const {SKILL_IDS,SKILL_LABELS,gameplayLevel,skillMetrics,xpAt}=mod;
assert.equal(SKILL_IDS.length,11);
assert.equal(new Set(SKILL_IDS).size,11);
assert.equal(gameplayLevel(0),0);
assert.equal(gameplayLevel(90),90);
assert.equal(gameplayLevel(100),95);
assert(Math.abs(gameplayLevel(100.1)-95.05)<1e-8);
assert.equal(gameplayLevel(110),100);
assert.equal(gameplayLevel(200),120);
assert.equal(gameplayLevel(245),130);
assert.equal(gameplayLevel(100+1),95.5);
const speed=skillMetrics('speed',95);
assert(Math.abs(speed[0].value-26.6037943857408)<1e-3, 'Official Speed model at real level 100');
assert(Math.abs(skillMetrics('speed',95.05)[0].value-speed[0].value-.0233864002459)<1e-3);
assert(Math.abs((xpAt(100.1)-xpAt(100))-1010000)<100);
for(const skill of SKILL_IDS) {
  assert(SKILL_LABELS[skill]);
  for(const level of [0,10,50,90,95,95.05,100,110,150,200,250]){
    const metrics=skillMetrics(skill,level);
    assert(metrics.length>=2, skill+' must expose multiple gameplay parameters');
    for(const item of metrics){
      assert(Number.isFinite(item.value), skill+' '+item.label+' at '+level+' was nonfinite');
      assert(item.label && item.unit!==undefined);
      assert(item.better==='up'||item.better==='down');
    }
  }
  const before=skillMetrics(skill,95),after=skillMetrics(skill,95.05);
  assert.equal(before.length,after.length);
  assert((after[0].value-before[0].value)*(before[0].better==='down'?-1:1)>=-1e-8,skill+' changed the wrong direction');
  console.log(skill+': '+before[0].label+' '+before[0].value.toFixed(6)+' → '+after[0].value.toFixed(6));
}
console.log('PASS: 11 game-skill calculators, all parameter values finite, high-level mapping, XP cost and Speed golden reference');
