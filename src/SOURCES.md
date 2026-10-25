# Vendored simulation provenance

- Origin: https://github.com/oss-idle/addon-sim
- Upstream revision inspected: `b6c14fd` (2026-10-24)
- Files adapted: `src/engine/*.ts`, `src/farm/metrics.ts`, `scripts/bundle-plugins.mjs`, and `scripts/resolve-game.mjs`.
- Game simulation: https://github.com/oss-idle/oss-idle commit `890882870f319db36e8fa8a72d1cb5a8c553d35e`; version 1.2.3.0, pinned by package-lock.json.
- Changes in toolkit: worker now accepts a manual fatigue-minute snapshot and simulates physical skills with the game's `tiredSkills` and `warmup` model; pure adaptive optimizer, playlist writer, and opt-in live queue.
- License: AGPL-3.0-only. See upstream projects for copyright holders. All source is retained in this public repository.
