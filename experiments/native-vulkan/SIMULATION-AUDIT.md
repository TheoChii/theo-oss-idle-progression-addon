# CPU/GPU workload audit for Smart Farm

Reviewed 2026-10-25 against **verified GitHub main v0.5.9**, commit
`efa47d6ae85430d51a0d236e2867d3324bd5de54`, and the pinned official
oss!idle game simulation sources.

## What the scanner actually computes

`src/engine/sim.worker.ts`: per map, the worker decodes the .osu chart
once, then for every selected rate and mod, repeats a complete simulation
(1 initial Screening run or 3 refinement runs). Each simulation initializes
a skill state, applies fatigue/warm-up, creates a CharacterBot and a ManiaGame,
advances the play to its end, computes the score/XP and applies PP calculation.
Important snippets: `skillsFrom`, `simulate`, `new CharacterBot`,
`new ManiaGame`, `game.update`, `bot.getSkillsXP`, `pp.calculate`.

`src/engine/client.ts`: desktop charts are read lazily per mapset; up to four
read requests share an I/O limiter, while Web Workers simulate different
sets concurrently. The worker pool, not the queue controller, owns gameplay
simulation. `src/scanStrategy.js` and `src/gpuAssist.js` do comparatively
simple priority scoring and rank selection.

Official pinned game logic in
`node_modules/oss-idle/packages/shared/src/sim/maniaGame.ts`:
`ManiaGame` converts the beatmap into timed runtime notes and input events,
judges events in chronological order, and updates HP and score. Later results
can depend on earlier misses, long notes, bot timing/skill state, and play
termination. `CharacterBot` also contains stochastic Gaussian timing errors
and skill/strain effects.

## Implications for native GPU compute

- Many **whole plays** across map/rate/mod/repetition combinations are
  independent and could theoretically run in CPU and GPU batches.
- Individual note events *within one play* are not trivially independent.
  A straight WGSL/GLSL translation of the score loop is not equivalent to
  the official simulation without reproducing HP, hold-judgement, bot RNG,
  fatigue, precision and XP accounting.
- PP uses rosu-pp WASM; simply computing candidate priority scores on GPU
  does not speed up the game's actual simulation.
- Native Vulkan helper would require a secure local-only connection between
  Electron's sandboxed add-on and an external native process, startup and data
  transfer costs, and rigorous deterministic or statistical cross-validation.
  NONE of that has been implemented, and the earlier native GPU hang is
  unresolved.
- On Intel HD Graphics 520, CPU outperformed native Vulkan on short and
  medium score batches when the game was closed. The one favorable 1M-vector
  result was from the earlier unstable test session; it is insufficient
  evidence of full-scan benefit.

## Safest next experiment (not yet performed)

Build a **CPU-only phase profiler** on a disposable branch or standalone
harness using representative 4K charts that the user explicitly supplies
or nonprivate fixtures. Run without touching the live game or game database.
Capture per-phase wall time per map: chart decode, ManiaGame construction,
event update, XP scoring, rosu-pp evaluation, post-processing, and chart IPC
read. Time both Screening and Refining with NM/HR selected modes.

Only if a large, independent hot spot emerges, design a small isolated
CPU/GLSL kernel with offline reference comparisons and test a *single*
corrected Vulkan batch while the game is closed and work is saved. Retain
the explicit native safety interlock. Never run unattended tests, change
driver hangcheck settings, or merge GPU code into the production add-on
until stability and end-to-end speedups are established.

## Current state and next step

**Research only** — no production source changed and no GPU dispatch run
during this review. v0.5.9 stable CPU scanner remains recommended.
Next step: noninvasive CPU-only profiling with a representative chart
fixture, then choose whether porting any hot spot has a chance of helping.
