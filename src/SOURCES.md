# Vendored simulation provenance

- Origin: https://github.com/oss-idle/addon-sim
- Upstream revision inspected: `b6c14fd` (2026-10-24)
- Files adapted: `src/engine/*.ts`, `src/farm/metrics.ts`, `scripts/bundle-plugins.mjs`, and `scripts/resolve-game.mjs`.
- Current simulation: https://github.com/oss-idle/oss-idle commit `7ebe02c6a98a4f9aaeb4a923aacbe6e5dae4e3ff`; official v1.2.5.0 tag. Former v0.5.0-v0.5.4 toolkit releases pinned 1.2.3.0 commit `890882870f319db36e8fa8a72d1cb5a8c553d35e`.
- Changes in toolkit: worker now accepts a manual fatigue-minute snapshot and simulates physical skills with the game's `tiredSkills` and `warmup` model; pure adaptive optimizer, playlist writer, and opt-in live queue.
- License: AGPL-3.0-only. See upstream projects for copyright holders. All source is retained in this public repository.

- v0.5.1: worker simulates NM and HR through pinned-game ManiaGame mod-specific timing windows and modXp bonus. The live queue selects one session-wide mod set because queue entries only support rates.

- v0.5.2: PP mode follows pinned server scores.ts recomputePP,
  weighting the best PP per beatmap by 0.95 raised to sorted rank.
  Its existing-best baseline comes from registered local scores and
  the public top-255 best PP records. The rosu performance calculation
  now includes the selected NM or HR mods as the official server does.

- v0.5.4: optional auto-upgrade planning uses the pinned game's `canUpgrade`/`applyUpgrade` implementation, official signed-in `GET /v1/me/character` and `POST /v1/me/upgrade`, and follows the server's deferred mid-play purchase behavior. Targets are the predicted raw OD total *after* buying each numbered gear tier. Explicit arming is never persisted.

- v0.5.5: upgraded pinned game sim to v1.2.5.0 and updated Coordination's physical/no-Mindblock handling; guarded retry of live queue with account/ownership verification, session-only consent, and server acknowledgement. No automatic reclaim on game reload.
