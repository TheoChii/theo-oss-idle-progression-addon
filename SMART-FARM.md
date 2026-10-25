## Smart Farm / Auto Queue (experimental, v0.5.6)

The Smart Farm panel is part of the **same installed toolkit**, opened and closed with **Ctrl+Shift+G** (no floating button). The original **Ctrl+Shift+P** calculator and its features are preserved.

### How the optimization works

This add-on bundles the scanning and worker-based simulation code adapted from [oss!idle sim](https://github.com/oss-idle/addon-sim), pinned to oss!idle **1.2.5.0**. It scans **downloaded ranked 4K maps**, screens unlocked rates, and refines promising difficulties by averaging three simulations per map/rate/mod variant. In v0.5.1, it evaluates both **No Mod (NM)** and **Hard Rock (HR)**, using the game's tighter HR hit windows and **1.10x Accuracy XP multiplier**. HR is not inherently optimal: it may reduce hit quality or cause failures. Comparing both modes increases scan time. The simulated bot has the saved character's skills, with its physical performance adjusted for the entered fatigue and warm-up. Medals, failure rates, run durations, and play-rate unlocks are included. Results are held in memory, not stored in localStorage.

The adaptive planner ranks by **expected XP/minute including transition overhead** and recomputes the rotation as the character, recent plays and fatigue inputs change. It models the official 24-hour Mindblock curve per map, the physical XP reduction from fatigue (5% floor), and a manual estimate of the physical strain share per play. It favors distinct maps and drops candidates below your minimum relative efficiency threshold. The summary displays **duration-weighted** total XP/minute rather than an unweighted mean of each map's rate.

Choose **Primary XP skill** (or all skills) and **Switch to** (Accuracy, any other skill, all non-physical, all eligible, or Stop). The initial fatigue cutoff is **10% physical XP retained**; you can change it. Skills at **Lv 100 + their current prestige count** are automatically excluded; if no selected or fallback skill is eligible, the managed queue stops. It does not buy upgrades, perform prestige, or change character progression.

Full-library scans happen when you press **Scan**, then at most every configured **10–120 minutes** while the live optimizer runs (default 20). Every minute the planner refreshes the character and the game's recent-score history and re-ranks cached simulation results. Upgrade or prestige changes trigger a new scan. Rate choices are stored per beatmap; one NM or HR setting applies to the entire queued rotation.

### PP Farm mode, new in v0.5.2

- Select Farming goal -> PP / Rank improvement. This initiates a new scan
  of downloaded ranked 4K maps. Full map downloads are not automated.
- The simulator tests NM and HR at unlocked playback rates, calculates
  PP with the active mods, and ranks predicted weighted profile gain.
- The game weighs its best PP on every unique beatmap by 0.95^rank.
  Playing a chart again without a PP personal best adds zero ranking PP.
- Choose Weighted PP gain / minute for efficiency or Highest weighted PP
  gain to focus on larger potential improvements. Minimum gain defaults
  to 0.25. PP mode does not depend on XP Mindblock penalties.
- Registered local scores and up to the top 255 server best-PP scores
  provide the baseline. The panel displays its data source. Offline
  local caches may be incomplete; PP estimates are not guarantees.
- Live optimization, when explicitly approved, rereads local scores
  approximately every minute, reads server bests at most every five
  minutes, and rescans downloaded charts at your selected interval.
  If no worthwhile new PP remains, the managed queue stops.
- Global NM/HR mods cannot differ between queued entries; playback
  speed can. The game may replay a map before client score history
  refreshes or finish the current map after a queue replacement.
- Switching between PP and XP clears the prior plan and stops
  any live managed queue; switching to PP begins a fresh scan.
  PP scoring never triggers automatic prestige or map downloads.

### Auto skill upgrades — opt-in (v0.5.4)

The bottom of the Smart Farm panel includes a separate **Auto skill
upgrades** section. Enable one or more of the 11 skills (all toggles OFF on a
fresh install), and expand each skill to set the raw Overdrive **total you
want after purchasing** upgrade tier #1, #2, etc. The game base ladder has
10 upgrades; prestige adds more tiers. The UI exposes up to 30 tier
targets per skill. Blank/default targets of 0 mean buy as soon as
the next gear upgrade is affordable. Target 25 on tier #2 means wait
until a tier-2 purchase would leave *at least 25 total raw Overdrive*.

The planner calculates affordability and projected OD with the game's exact
`applyUpgrade` math. Overdrive is **earned by overspending levels**, not
a currency spent to buy upgrades. Buying gear **spends actual XP levels**,
may lower overall character level and affects ranking metrics; the action
cannot be automatically undone. Buying Memory gear can forget earlier plays.

Merely checking a skill is not enough. Check the level-spending confirmation
and click **Arm auto-upgrades**. Every minute, while the game/add-on is open,
the manager checks the authoritative server's active character and skill
levels, compares the projected OD to the configured target, and sends at
most **one** authenticated `POST /v1/me/upgrade` per check. Multiple enabled
skills are round-robin, preventing one from permanently taking priority.
During an active play the server may defer a requested purchase. Such
pending tiers will **not be requested again** until the server confirms that
the gear level advanced. The user must manually rearm if the game's pending
purchase never resolves. Server errors stop the checker. Offline guests,
account/character mismatches and character switches cannot receive a
purchase. Master arming is **OFF whenever the add-on loads**, no matter what
individual skill choices you saved. This operates independently of live
queue optimization. Click **Stop auto-upgrades** to disarm; already queued
server-side actions can still complete. **Auto-prestige is not included.**

### Saving settings

Normal Smart Farm planner preferences have been saved automatically in
local storage since v0.5.0. v0.5.4 additionally saves each skill's enabled
preference and the numbered OD targets. The **Save / transfer Smart Farm
settings** area lets you save again, export the settings as JSON (copy
the text into a personal note), and import a prior backup on the same or
a different device. Importing never arms purchases or starts the live
queue. Raw session authentication and bearer tokens are never exported.
All settings are **local to this device and browser profile** and can be
lost if site storage is cleared. Saving an enabled skill preference does
not mean auto-upgrades remain active after a restart.

### Updated game mechanics and reconnection (v0.5.5)

Coordination is now physical, fatigue-affected, and Mindblock-exempt
as of official game version 1.2.5.0. This change is applied both to
the pinned sim worker and our map optimizer. The game now displays
Warm-up and Fatigue on a combined HUD bar; the planner still needs
your manual estimated strained minutes because the authoritative
accumulator is not available from its local bridge.

During an *already approved* live queue session, temporary WebSocket
drops retry up to five times (2s, 4s, 8s, 16s, 30s). To resume, the
official server must confirm the same character and the optimizer's
original managed queue label. If the queue was taken over elsewhere,
the optimizer stops and NEVER restores it without a new approval.
During initial queue takeover, an old-label snapshot is tolerated until
the server confirms the owned queue; missing acknowledgement after
12 seconds stops safely. A page/app/add-on reload does not reconnect
automatically because consent is session-only. Once disconnected,
the existing server queue can continue autonomously; the Stop button
will warn if it could not clear the server queue. No real signed-in
server session has yet verified this behavior.

### Downloaded-map scan fix (v0.5.6)

On oss!idle **v1.2.5.0 desktop**, beatmaps reside in **map folders**
instead of the browser's IndexedDB. The older SDK beatmap-store API
could no longer see those downloaded charts. Smart Farm now uses the
game's official read-only desktop library bridge: it lists only the
`maps` folders and reads the requested .osu charts lazily for each
simulated mapset. Simulation workers receive only the current set's
text, never the full song library in memory. Browser players retain
the original IndexedDB worker path.

Instead of waiting indefinitely at 'Reading character and downloaded
maps', the scan shows each initialization stage and uses bounded
timeouts. If a database read or a map-folder listing stalls, an error
identifies that step so you can check the game/desktop map library
or restart the client. **The online medal request does not hold up
scanning:** if it fails, the planner uses 1x and displays a warning
about potentially understated XP. The ranked map catalog is still
required for online XP and PP so unranked maps are never silently
treated as ranked.

To use the fix, update to v0.5.6, open Smart Farm (Ctrl+Shift+G),
click **Scan downloaded maps**, and observe the progress phases.
A restart may be needed if oss!idle's IndexedDB-to-folder migration
is still running. The desktop-folder logic and timeouts are tested
with mocked game bridges; no authenticated live desktop test has been
performed. Existing settings, queue approval and upgrade safety are
unchanged.

### Starting safely

1. Open **⚡ Smart Farm**, select a primary skill and fallback, then choose **Mod strategy**: Auto (best whole rotation), No Mod only, or HR only. Enter your current **strained fatigue minutes**. The game keeps its authoritative fatigue on the server and does **not** publish that number through the local add-on database, so this value must be entered or periodically corrected manually.
2. Click **Scan downloaded maps**. This may take time and uses several CPU cores. Inspect the recommended maps, their best play rates, selected whole-session mod strategy (NM or HR), both mode estimates in XP/min, and the predicted fatigue.
3. To use the game's normal song-select workflow without changing the live queue, click **Save managed playlist**. It only replaces a playlist called **Theo Smart Farm (managed)** and never deletes your other playlists. **Reopen Song Select** to see its changes. The playlist stores per-map rates but not mods. Set HR or NM yourself using the game's mod controls.
4. To actually control the **live server queue**, explicitly check the confirmation to replace your current queue, change its global NM/HR mods, and enable Autopilot Playlist, then click **Start live optimizer**. This opens another authenticated connection to the **official game WebSocket**, checks that the active character matches the simulated one, and sends the game's documented `queue:set` messages. Re-ranking replaces the managed queue rather than appending endless duplicates. The option is **OFF by default**.
5. Click **Stop and clear managed queue** to pause/clear **only the queue owned by this tool**, restoring your prior autopilot mode and global mods when the authenticated socket stays connected. If it disconnects, restore game mods manually if needed. Disabling the add-on stops further scans and attempts to clear an owned queue. Do not use two automated queue managers at once; changes from another source stop this manager rather than silently overriding it.

**Limitations:** Live queue operations are protocol-based and **have not been tested in a signed-in production client**. The server is authoritative; a queued or currently playing map may still finish before updates take effect. Queue entries support individual rates, **not individual mods**. Smart Farm changes only the session-wide NM/HR preference and never the mod of an already running play. While active, it may reapply its chosen mods if settings are changed in-game. Automatic queue revisions require the game to be running; when the client closes, further optimization stops, though server-managed autoplay may already have begun. The official map sim's random results and your manual fatigue estimate introduce uncertainty. Fatigue changes also affect hit accuracy/failures, not just the XP-floor factor, and predictions cannot fully capture future changes between whole-library rescans.

### Build

The source code under `src/engine/` and `src/farm/metrics.ts` is adapted from [oss-idle/addon-sim](https://github.com/oss-idle/addon-sim), upstream revision `b6c14fd`, licensed under **AGPL-3.0**. It includes our fatigue-aware worker changes. The game simulation dependency is now pinned to official oss!idle v1.2.5.0 commit `7ebe02c6a98a4f9aaeb4a923aacbe6e5dae4e3ff`. v0.5.4 and earlier used game v1.2.3.0. See `src/SOURCES.md` for provenance.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

The final self-contained `dist/progression-toolkit.addon.js` bundles all dependencies and the game simulator. The GitHub-built release fetches and builds the tagged source using the lockfile; **do not paste the unbundled `progression-toolkit.addon.js` source by itself for Smart Farm**.

### Testing status

All 22 automated test suites run under `npm test`, including an isolated simulated official WebSocket protocol test verifying explicit approval, account identity, queue replacement, idle scheduling, pausing and restoring Autopilot and previous global mods. Includes synthetic HR/NM XP strategy tests and source-level checks of the pinned game simulation. These are **mocks**, not a test against the live service.
