## Smart Farm / Auto Queue (experimental, v0.5.1)

The Smart Farm panel is part of the **same installed toolkit**, opened from the **⚡ Smart Farm** floating button or **Ctrl+Shift+G**. The original **Ctrl+Shift+P** calculator and its features are preserved.

### How the optimization works

This add-on bundles the scanning and worker-based simulation code adapted from [oss!idle sim](https://github.com/oss-idle/addon-sim), pinned to oss!idle **1.2.3.0**. It scans **downloaded ranked 4K maps**, screens unlocked rates, and refines promising difficulties by averaging three simulations per map/rate/mod variant. In v0.5.1, it evaluates both **No Mod (NM)** and **Hard Rock (HR)**, using the game's tighter HR hit windows and **1.10x Accuracy XP multiplier**. HR is not inherently optimal: it may reduce hit quality or cause failures. Comparing both modes increases scan time. The simulated bot has the saved character's skills, with its physical performance adjusted for the entered fatigue and warm-up. Medals, failure rates, run durations, and play-rate unlocks are included. Results are held in memory, not stored in localStorage.

The adaptive planner ranks by **expected XP/minute including transition overhead** and recomputes the rotation as the character, recent plays and fatigue inputs change. It models the official 24-hour Mindblock curve per map, the physical XP reduction from fatigue (5% floor), and a manual estimate of the physical strain share per play. It favors distinct maps and drops candidates below your minimum relative efficiency threshold. The summary displays **duration-weighted** total XP/minute rather than an unweighted mean of each map's rate.

Choose **Primary XP skill** (or all skills) and **Switch to** (Accuracy, any other skill, all non-physical, all eligible, or Stop). The initial fatigue cutoff is **10% physical XP retained**; you can change it. Skills at **Lv 100 + their current prestige count** are automatically excluded; if no selected or fallback skill is eligible, the managed queue stops. It does not buy upgrades, perform prestige, or change character progression.

Full-library scans happen when you press **Scan**, then at most every configured **10–120 minutes** while the live optimizer runs (default 20). Every minute the planner refreshes the character and the game's recent-score history and re-ranks cached simulation results. Upgrade or prestige changes trigger a new scan. Rate choices are stored per beatmap; one NM or HR setting applies to the entire queued rotation.

### Starting safely

1. Open **⚡ Smart Farm**, select a primary skill and fallback, then choose **Mod strategy**: Auto (best whole rotation), No Mod only, or HR only. Enter your current **strained fatigue minutes**. The game keeps its authoritative fatigue on the server and does **not** publish that number through the local add-on database, so this value must be entered or periodically corrected manually.
2. Click **Scan downloaded maps**. This may take time and uses several CPU cores. Inspect the recommended maps, their best play rates, selected whole-session mod strategy (NM or HR), both mode estimates in XP/min, and the predicted fatigue.
3. To use the game's normal song-select workflow without changing the live queue, click **Save managed playlist**. It only replaces a playlist called **Theo Smart Farm (managed)** and never deletes your other playlists. **Reopen Song Select** to see its changes. The playlist stores per-map rates but not mods. Set HR or NM yourself using the game's mod controls.
4. To actually control the **live server queue**, explicitly check the confirmation to replace your current queue, change its global NM/HR mods, and enable Autopilot Playlist, then click **Start live optimizer**. This opens another authenticated connection to the **official game WebSocket**, checks that the active character matches the simulated one, and sends the game's documented `queue:set` messages. Re-ranking replaces the managed queue rather than appending endless duplicates. The option is **OFF by default**.
5. Click **Stop and clear managed queue** to pause/clear **only the queue owned by this tool**, restoring your prior autopilot mode and global mods when the authenticated socket stays connected. If it disconnects, restore game mods manually if needed. Disabling the add-on stops further scans and attempts to clear an owned queue. Do not use two automated queue managers at once; changes from another source stop this manager rather than silently overriding it.

**Limitations:** Live queue operations are protocol-based and **have not been tested in a signed-in production client**. The server is authoritative; a queued or currently playing map may still finish before updates take effect. Queue entries support individual rates, **not individual mods**. Smart Farm changes only the session-wide NM/HR preference and never the mod of an already running play. While active, it may reapply its chosen mods if settings are changed in-game. Automatic queue revisions require the game to be running; when the client closes, further optimization stops, though server-managed autoplay may already have begun. The official map sim's random results and your manual fatigue estimate introduce uncertainty. Fatigue changes also affect hit accuracy/failures, not just the XP-floor factor, and predictions cannot fully capture future changes between whole-library rescans.

### Build

The source code under `src/engine/` and `src/farm/metrics.ts` is adapted from [oss-idle/addon-sim](https://github.com/oss-idle/addon-sim), upstream revision `b6c14fd`, licensed under **AGPL-3.0**. It includes our fatigue-aware worker changes. The game simulation dependency is pinned to oss!idle commit `890882870f319db36e8fa8a72d1cb5a8c553d35e` (game version 1.2.3.0). See `src/SOURCES.md` for provenance.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

The final self-contained `dist/progression-toolkit.addon.js` bundles all dependencies and the game simulator. The GitHub-built release fetches and builds the tagged source using the lockfile; **do not paste the unbundled `progression-toolkit.addon.js` source by itself for Smart Farm**.

### Testing status

All 12 automated test suites run under `npm test`, including an isolated simulated official WebSocket protocol test verifying explicit approval, account identity, queue replacement, idle scheduling, pausing and restoring Autopilot and previous global mods. Includes synthetic HR/NM XP strategy tests and source-level checks of the pinned game simulation. These are **mocks**, not a test against the live service.
