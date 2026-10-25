# Offline CPU profiling of Smart Farm simulations

**Date:** 2026-10-25 (America/Los_Angeles)
**Code:** TheoChii/theo-oss-idle-progression-addon, pinned oss!idle 1.2.6.0
(commit f999af7cf0bdf431a83d675529e1fcb05514b88a)
**Status:** Research-only. No production add-on changes. No GPU work performed.

## Goal

Measure where the current official game's CPU worker spends time
before choosing any native CPU/GPU split.

Profiling runs outside oss!idle, using a generated synthetic 4-key osu!mania
chart, the exact pinned `ManiaGame`, `CharacterBot`, skills/fatigue
and the `rosu-pp-js` performance calculator. **No account files, downloads,
game database, installed add-on, real map collection, network calls or
GPU compute are involved.**

## Running offline

From the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
node experiments/native-vulkan/build-cpu-profile.mjs
nice -n 15 timeout 35s node experiments/native-vulkan/.cpu-profile-run.mjs --notes=384 --samples=3 --mod=NM
nice -n 15 timeout 35s node experiments/native-vulkan/.cpu-profile-run.mjs --notes=768 --samples=3 --mod=NM
```

`--notes`: 64–4,000; `--samples`: 1–8; `--rate`:
0.5–2.0; `--mod`: NM or HR; optional `--skill-detail=yes` times
each of the 11 skill-analyze methods (adds instrumentation overhead).
Defaults: 384 notes, 3 samples,
1× rate, NM. Output is phase-timing JSON on stdout. The build script
bundles pinned TypeScript source for Node; the gameplay math is from
the pinned release, without rewriting the simulation. A React-hook stub
throws if any UI hook is unexpectedly invoked. Built output is ignored
by Git. `rosu-pp-js` is used only from the Node dependency installed
by the project's existing lockfile.

The fixture is generated entirely in memory: 4 columns, regular taps,
roughly every 11th note a long note. The game skill state is synthetic
(11 skills with level 60, 4 prior plays). No account or personal chart
data is used. Each iteration creates skills/bot/ManiaGame anew.
The initial decode and PP beatmap parsing occur once, as in the real
Smart Farm worker; PP difficulty attributes are cached once per test.

### Timing stages

- `chartDecode`: osu-parser decode (once per chart)
- `ppBeatmapParse`: rosu-pp beatmap parse (once per chart)
- `ppDifficultyCalculate`: rosu-pp difficulty (once per rate/mod)
- `skillsAndFatigue`: prepare simulated skill state per play
- `botConstructor`: create CharacterBot
- `maniaGameConstructIncludesBotEventGeneration`: instantiate official
  ManiaGame: note conversion, HP/scroll setup, bot events, scheduling
- `botGenerateEventsInsideGameConstruct`: timed official bot method
  inside ManiaGame's constructor (subset of constructor, **do not add**)
- `botAnalyzeSkillStrains`: timed official bot skill analysis
  (subset of botGenerateEvents, **do not add**)
- `maniaGameUpdateAndJudging`: process chronologically judged events
- `xpCalculation`: getSkillsXP + modXp
- `ppPerformanceCalculate`: rosu-pp performance score calculation

The two nested measurements are wrappers of the actual public
`CharacterBot` methods: they don't change decisions or output.
Nested times should never be summed with their parent times.

## Measurement results (Fedora 44, Core i5-6200U)

These are rough means from three runs with an offline synthetic 4K
chart, NM, rate 1×. The game had already been reopened; we ran at
low scheduling priority (`nice -n 15`) and used no real account
data or GPU. Background load and JIT can influence these numbers.

| Phase (mean) | 384 notes | 768 notes |
| --- | ---: | ---: |
| Chart decode, once | 19.78 ms | 53.83 ms |
| Total measured work **per play** | **169.09 ms** | **281.97 ms** |
| Game construction (including bot events) | 150.37 ms | 250.32 ms |
| ...Bot generate events (included above) | 80.39 ms | 159.65 ms |
| ......Skill-strain analysis (included above) | **72.61 ms** | **147.75 ms** |
| Game construction excluding bot event generation | 69.99 ms | 90.67 ms |
| Final note judging | 2.84 ms | 15.57 ms |
| XP calculation | 2.86 ms | 3.03 ms |
| PP performance calculation | 4.20 ms | 7.51 ms |

Game construction represented approximately 89% of per-play time for both
chart sizes. Skill-strain analysis alone consumed about 43% (384 notes)
and 52% (768 notes) of total measured per-play time, and about 90%+ of
the bot's own event-generation time. The official bot analyzes **11**
character skills for each runtime note.

An earlier uninstrumented set of runs with NM and HR similarly placed
the game constructor at ~83–87% of per-play time, but measurements
varied across executions. These are **preliminary** timing signals, not
reproducible benchmarks of complete downloaded-map scans.

## Optional per-skill diagnosis (768 synthetic notes, 2 runs)

The profiler can additionally instrument the exact eleven **fatigue-adjusted
skill objects** passed to CharacterBot (fatigue creates copies). Results
from one low-priority diagnostic run, **milliseconds accumulated per play**:

| Skill | Analyze duration |
| --- | ---: |
| Speed | 20.91 ms |
| Reading | 15.40 ms |
| SpeedJam | 6.34 ms |
| JackSpeed | 6.11 ms |
| Memory | 6.03 ms |
| Stamina | 5.09 ms |
| Consistency | 4.78 ms |
| Coordination | 2.87 ms |
| Concentration | 1.62 ms |
| Release | 1.34 ms |
| Accuracy | 1.21 ms |

This single optional *heavily instrumented* run had 0 failed plays
and judged all 768 notes; rosu-pp returned positive PP. Per-skill wrapper
overhead changes the overall runtime, so do **not** compare these totals
directly to the uninstrumented total timings above. The ranking is
suggestive, not a definitive speedup forecast.

Source inspection explains why Speed and Reading may dominate this
fixture: Speed repeatedly asks for recent notes and computes weighted
note groups; Reading repeatedly looks up visible notes, groups their
column patterns and counts transitions. Both also use previous strain
state and random timing outcomes. Potential reuse/window-indexing
optimizations could help on CPU, but require strict gameplay-parity
checks before changes to the official logic. No such optimizations
were applied in this experiment.

## GPU vs CPU implications

- The old WebGPU/Vulkan priority-ranking work was too small to
  justify GPU overhead on the Intel HD 520.
- The official `CharacterBot.analyzeContext` note/skill loop is
  more substantial, but **not obviously GPU-safe to translate**:
  individual skill analyzers inspect neighboring notes and shared
  strain state; the bot samples random timing error, and the
  later note-judgement/HP pipeline has sequential dependencies.
- The next lowest-risk improvement would be profiling the **individual
  11 skill analyze methods** and their per-note context lookups,
  followed by careful CPU-side algorithmic optimization and
  reference-result tests. Only consider a GPU port if a genuinely
  independent kernel with worthwhile batch sizes is identified.
- Hardware is a low-power integrated GPU sharing memory/power
  with the CPU. Native Vulkan compute previously triggered an i915
  GPU hang in a different test, although short supervised tests
  with oss!idle closed subsequently passed. **No GPU stress testing,
  kernel changes, IPC daemon or direct Smart Farm integration**
  was performed for this CPU profiling work.

## Limitations

- Synthetic 4K charts, not representative of every user's charts,
  SV-heavy timing files, very dense LN charts, or skill distributions.
- This script is offline and cannot measure desktop chart IPC
  bridge latencies, worker creation/scheduling, UI updates, or
  actual entire scan time; it does not model a user-loaded map library.
- Per-play times include JIT/warm-up noise. They should not be used
  to promise speedups.
- All production gameplay/PP formulas remain unchanged.

## Next steps

1. Leave v0.5.9 and draft native GPU PR unchanged in release status.
2. For a further profiling pass, time individual skill analyzers on
   synthetic charts with variable density and LN patterns.
3. Test targeted CPU optimizations before attempting expensive
   shader rewrites or localhost helper integration.
