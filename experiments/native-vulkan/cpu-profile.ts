/**
 * Standalone CPU-only offline profiler using the pinned official game sources.
 * Synthetic osu!mania 4K charts only; no game DB, account, network or GPU.
 */
import {performance} from 'node:perf_hooks';
import '@oss-idle/shared/osu/controlPointPatch';
import {BeatmapDecoder} from 'osu-parsers';
import rosu from 'rosu-pp-js';
import {ManiaGame} from '@oss-idle/shared/sim/maniaGame';
import CharacterBot from '@oss-idle/shared/sim/bots/character';
import {makeOrderedSkills} from '@oss-idle/shared/sim/skills/factory';
import Memory from '@oss-idle/shared/sim/skills/memory';
import {tiredSkills, fatigueLevel, warmup} from '@oss-idle/shared/fatigue';
import {modXp} from '@oss-idle/shared/mods';

const opts=Object.fromEntries(process.argv.slice(2).filter(x=>x.startsWith('--')).map(x=>{
 const [k,v]=x.slice(2).split('=',2);return [k,v];
}));
const notes=Number(opts.notes??384),samples=Number(opts.samples??3);
const rate=Number(opts.rate??1),mod=opts.mod??'NM';
const skillDetail=opts['skill-detail']==='yes';
if(!Number.isSafeInteger(notes)||notes<64||notes>4000
 ||!Number.isSafeInteger(samples)||samples<1||samples>8
 ||!Number.isFinite(rate)||rate<.5||rate>2
 ||!['NM','HR'].includes(mod)){
 console.error('Use --notes=64..4000 --samples=1..8 --rate=0.5..2 --mod=NM|HR');
 process.exit(2);
}

function generateChart(n){
 const lines=[
 'osu file format v14','',
 '[General]','AudioFilename: silent.mp3','AudioLeadIn: 0','PreviewTime: -1','Countdown: 0','SampleSet: Normal','StackLeniency: 0.7','Mode: 3','LetterboxInBreaks: 0','',
 '[Editor]','DistanceSpacing: 1','BeatDivisor: 4','GridSize: 4','TimelineZoom: 1','',
 '[Metadata]','Title: Synthetic Profile Chart','TitleUnicode: Synthetic Profile Chart','Artist: Offline Fixture','ArtistUnicode: Offline Fixture','Creator: CPU Profiler','Version: Four Keys','Source:','Tags: synthetic offline','BeatmapID: 900001','BeatmapSetID: 900001','',
 '[Difficulty]','HPDrainRate: 5','CircleSize: 4','OverallDifficulty: 6','ApproachRate: 5','SliderMultiplier: 1.4','SliderTickRate: 1','',
 '[Events]','',
 '[TimingPoints]','0,500,4,2,0,100,1,0','',
 '[HitObjects]'
 ];
 for(let i=0;i<n;i++){
  const col=(i*7+Math.floor(i/7))%4;
  const x=64+128*col;
  const t=2000+i*130;
  if(i%11===0){
   const end=t+260;
   lines.push(x+',192,'+t+',128,0,'+end+':0:0:0:0:');
  }else lines.push(x+',192,'+t+',1,0,0:0:0:0:');
 }
 return lines.join('\n')+'\n';
}
const text=generateChart(notes);
const decoder=new BeatmapDecoder();
const phases=new Map();
const outcomes=[];
function measure(name,work){
 const t=performance.now();
 const result=work();
 const spent=performance.now()-t;
 const arr=phases.get(name)??[];
 arr.push(spent);phases.set(name,arr);
 return result;
}
// Instrument the real CharacterBot method without changing its inputs/results.
// This isolates event generation from all other ManiaGame constructor work.
const originalAnalyze=CharacterBot.prototype.analyzeContext;
CharacterBot.prototype.analyzeContext=function(...args){
 return measure('botAnalyzeSkillStrains',()=>originalAnalyze.apply(this,args));
};
const originalGenerate=CharacterBot.prototype.generateEvents;
CharacterBot.prototype.generateEvents=function(...args){
 return measure('botGenerateEventsInsideGameConstruct',()=>originalGenerate.apply(this,args));
};
function sum(x){return x.reduce((a,b)=>a+b,0);}
function stats(arr){return {meanMs:+(sum(arr)/arr.length).toFixed(4),
 minMs:+Math.min(...arr).toFixed(4),maxMs:+Math.max(...arr).toFixed(4),calls:arr.length};}
const decoded=measure('chartDecode',()=>decoder.decodeFromString(text));
for(const point of decoded.controlPoints.timingPoints)point.beatLengthUnlimited=point.beatLength;
const ppmap=measure('ppBeatmapParse',()=>new rosu.Beatmap(text));
const skills=()=>makeOrderedSkills(60).map(skill=>{
 if(skill instanceof Memory)skill.timesPlayed.set(4);
 return skill;
});
const mods=mod==='HR'?['HR']:[];
let diff;
try{
 const calc=measure('ppDifficultyConstructor',()=>new rosu.Difficulty({lazer:false,clockRate:rate,mods:mods.join('')}));
 try{diff=measure('ppDifficultyCalculate',()=>calc.calculate(ppmap));}
 finally{calc.free();}
 for(let i=0;i<samples;i++){
  const tuned=measure('skillsAndFatigue',()=>tiredSkills(skills(),fatigueLevel(0),warmup(0,0)));
  // tiredSkills deliberately clones skills, so instrument the actual clones
  // passed to CharacterBot, not their pre-fatigue originals.
  if(skillDetail)for(const skill of tuned){
   const analyze=skill.analyze.bind(skill);
   skill.analyze=((...args)=>measure('skillAnalyze.'+skill.name,()=>analyze(...args)));
  }
  const bot=measure('botConstructor',()=>new CharacterBot(tuned));
  const game=measure('maniaGameConstructIncludesBotEventGeneration',()=>new ManiaGame(decoded,bot,{divine:false,rate,mods}));
  measure('maniaGameUpdateAndJudging',()=>game.update(game.songEndMs+2000));
  const xp=measure('xpCalculation',()=>modXp(bot.getSkillsXP(decoded.totalLength/rate,game.score),mods));
  const performanceAttrs=measure('ppPerformanceCalculate',()=>{
   const score=game.score;
   const perf=new rosu.Performance({
    lazer:false,clockRate:rate,mods:mods.join(''),
    legacyTotalScore:Math.floor(score.score),
    accuracy:Math.min(1,score.accuracy),
    combo:score.maxCombo,
    nGeki:(score.counts.MARVELOUS??0)+(score.counts.DIVINE??0),
    n300:score.counts.PERFECT??0,nKatu:score.counts.GREAT??0,
    n100:score.counts.GOOD??0,n50:score.counts.BAD??0,
    misses:score.counts.MISS??0
   });
   try{return perf.calculate(diff);}
   finally{perf.free();}
  });
  if(!Number.isFinite(performanceAttrs.pp))throw new Error('Nonfinite PP');
  const expectedXp=Object.values(xp).reduce((a,b)=>a+Number(b),0);
  if(!Number.isFinite(expectedXp))throw new Error('Nonfinite XP');
  // Performance result and difficulty attrs are WASM allocations; release promptly.
  outcomes.push({failed:Boolean(game.score.failed),accuracy:+Number(game.score.accuracy).toFixed(4),
   pp:+Number(performanceAttrs.pp).toFixed(3),xp:+expectedXp.toFixed(3),
   hits:game.hits.length,totalNotes:game.totalNotes});
  performanceAttrs.free();
 }
}finally{diff?.free();ppmap.free();}
const all=Object.fromEntries([...phases].map(([key,values])=>[key,stats(values)]));
const perPlay=['skillsAndFatigue','botConstructor','maniaGameConstructIncludesBotEventGeneration','maniaGameUpdateAndJudging','xpCalculation','ppPerformanceCalculate'];
const perPlayTotal=sum(perPlay.map(k=>all[k]?.meanMs||0));
const ratio=Object.fromEntries(perPlay.map(k=>[k,+((all[k]?.meanMs||0)/perPlayTotal*100).toFixed(2)]));
const perSkill=Object.fromEntries([...phases].filter(([key])=>key.startsWith('skillAnalyze.')).map(([key,values])=>[key.slice(13),{calls:values.length,meanTotalMsPerPlay:+(sum(values)/samples).toFixed(4)}]));
const botTime=all.botGenerateEventsInsideGameConstruct?.meanMs??0;
const gameSetupTime=all.maniaGameConstructIncludesBotEventGeneration.meanMs-botTime;
const strainTime=all.botAnalyzeSkillStrains?.meanMs??0;
console.log(JSON.stringify({
 benchmark:'offline-CPU-only-official-game-1.2.6.0',synthetic:true,
 notes,samples,rate,mod,ppActive:true,
 skillDetail:skillDetail?perSkill:undefined,
 outcomeSummary:{failedPlays:outcomes.filter(x=>x.failed).length,
  meanAccuracy:+(sum(outcomes.map(x=>x.accuracy))/outcomes.length).toFixed(4),
  meanPP:+(sum(outcomes.map(x=>x.pp))/outcomes.length).toFixed(3),
  meanXP:+(sum(outcomes.map(x=>x.xp))/outcomes.length).toFixed(3),
  meanJudgedHits:+(sum(outcomes.map(x=>x.hits))/outcomes.length).toFixed(1)},
 phaseStats:all,perPlayTotalMeanMs:+perPlayTotal.toFixed(4),
 perPlayPercent:ratio,
 constructorBreakdown:{botGenerateEventsMeanMs:+botTime.toFixed(4),
  otherGameConstructionMeanMs:+gameSetupTime.toFixed(4),
  botGenerationShareOfConstructorPct:+(100*botTime/all.maniaGameConstructIncludesBotEventGeneration.meanMs).toFixed(2),
  skillStrainAnalysisMeanMs:+strainTime.toFixed(4),
  skillStrainShareOfBotGenerationPct:+(100*strainTime/botTime).toFixed(2)},
 note:'Synthetic chart, not an actual downloaded user map. Game construction includes bot event generation. No GPU or account access.'
},null,2));
