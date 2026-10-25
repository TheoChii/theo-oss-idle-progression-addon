# Theo's oss!idle Progression Toolkit ⚡

An unofficial, experimental in-game progression toolkit add-on for [oss!idle](https://github.com/oss-idle/oss-idle).

**Vibe-coded by Theo with AI assistance.** This project was developed using AI-generated and AI-assisted code, with review and automated tests. Its estimates are not official game guidance.

## Three toolkit sections + Smart Farm panel

- **Calculators:** Skill Improvement, Overdrive, Prestige, Rebirth, Farming, and Warm-up.
- **Friends:** user-approved account-follow queue, optional username lookup, current followers toward medal thresholds, 6.5-second spacing, pause/stop, duplicate avoidance and explicit per-batch confirmation. Sends **no messages** and does not auto-select anyone.
- **Smart Farm** (separate panel, **Ctrl+Shift+G**): simulator-powered adaptive XP/min farming planner, per-map best unlocked rates, physical fatigue and Mindblock, prestige stops, managed playlist and optional live queue control. [Full guide](SMART-FARM.md).
- **Discovery:** filter downloaded osu!mania beatmaps to find difficulties with no local score for the selected character. Includes search, max stars, sort order, play count, and a link to the corresponding osu! beatmap page. Discovery is 4K-only, so it does not display a redundant key-mode dropdown.

Discovery uses oss!idle's read-only local SQL database bridge and the downloaded beatmap IndexedDB metadata, as documented in the [official add-on SDK](https://github.com/oss-idle/addon-sdk/blob/master/packages/addon-sdk/README.md). It does **not** contact a live ranked-map catalog, and “no local play found” does not prove the character has never played a chart on another device or before clearing data. Characters are suggested from the latest locally stored score, with a manual selector if that guess is wrong. Select **Refresh** after starting the client or finishing a play.

**Updated in v0.5.1:** [Smart Farm / Auto Queue](SMART-FARM.md) now compares **No Mod versus Hard Rock** using real timing windows and HR's +10% Accuracy XP bonus at every screened rate, chooses the better whole-rotation mod setting, and keeps per-map speed rates. No Mod/HR-only selection is available. The official queue does not support individual mod choices per entry, so live mod changes are session-wide and explicitly approved. The existing Smart Farm runs the official sim engine against downloaded maps, selects the best eligible play rate per map, estimates XP per minute after physical fatigue/Mindblock, switches XP targets, and stops when targets are prestige-ready. Live queue writes are opt-in and unverified in production. There are **no automatic gameplay actions on install**. The game version pinned for simulation is now 1.2.5.0.

## Hard Rock and No Mod comparison (v0.5.1)

The simulator now tries **NM and HR at unlocked playback rates**. HR narrows hit
windows to 1/1.4 of their original width and multiplies **Accuracy XP by 1.10**
under the game's official mod XP calculation. It can win on easy maps and lose
on difficult ones; the toolkit ranks by XP/min, not adding 10% to all scores.

The **Mod strategy** selector offers **Auto (best whole rotation)**, **NM-only**,
and **HR-only**. Each map still chooses its own unlocked playback rate.
The game allows a locked rate per queue entry but only **global mods per character**.
Therefore Smart Farm optimizes a complete NM rotation or HR rotation, not an
impossible mix of different mods per song. During an explicitly approved live
queue session, it sets the global mods and can change that setting when the
optimal whole-queue strategy changes. No mod change occurs on install.
When you press Stop while connected, it attempts to restore your previous
mod choices and Autopilot mode. If the connection fails, you may need to
restore your mods manually.

The local **Save managed playlist** option stores rates but **cannot store
per-song mods**. Select the recommended global NM/HR mode manually in-game.
Live simulation and mod changes remain experimental until exercised in-game.

## New: PP Farm automatic map scan (v0.5.2)

Choose Farming goal -> PP / Rank improvement in the Smart Farm panel. This
starts a new scan of downloaded ranked 4K maps with every unlocked speed
rate and No Mod / Hard Rock. PP uses the official weighted best-map total:
sort the highest PP on every distinct beatmap, then sum PP x 0.95^position.
Repeated plays do not add PP unless they beat the prior best.

The manager reads registered ranked best-PP scores from the local game
database, then attempts to fill missing data from the official public
best-PP endpoint (up to 255 top scores). It computes the expected
INCREMENTAL weighted PP improvement for a map, relative to the existing
score. Choose Weighted PP gain / minute or Highest weighted PP gain,
set a minimum improvement (default 0.25), and it avoids already
outperformed charts and high-failure simulations. PP-mode maps are unique.
No PP is guaranteed: simulated results are stochastic, and remote best
scores outside the top 255 or unavailable API data can make estimates
optimistic. The current best-PP source is shown in the panel.

In PP mode, a manually approved live optimizer updates its plan every
minute as local scores arrive, refreshes the public PP leaderboard about
every five minutes, and rescans the downloaded library every configured
10-120 minutes (default 20). It stops the managed queue if no simulated
gain remains. This is only active while the add-on/game is running.
The local managed playlist is preview-only until you start live queue;
global mods still require explicit consent, and per-map rates are preserved.
The server may replay a chart before the next local score refresh.

v0.5.2 also fixes PP simulation for HR: the rosu-pp calculator now receives
the active mods just like the server does, in addition to timing-window
changes already modeled in v0.5.1. PP mode does not perform prestige.
XP mode remains available and is unchanged.

## v0.5.3 — Keyboard shortcut only

Removed the persistent floating Smart Farm button. Use **Ctrl+Shift+G**
to open and close Smart Farm, or **Esc** to close it. Holding the shortcut
will not rapidly toggle the panel. The rest of the Smart Farm planner,
automatic scanning, managed playlists and opt-in live queue are unchanged.

## v0.5.4 — Optional automatic skill upgrades and saved settings

Smart Farm (Ctrl+Shift+G) now has **Auto skill upgrades**, with an independent
checkbox for each of the game's 11 skills. All are **OFF by default**.
Each skill has separate **targets for numbered upgrade tiers** (#1 through
#10, plus the extra tiers unlocked by prestige). A target is the minimum
**total raw Overdrive (sigma) AFTER buying that tier**. For example, target
40 on upgrade #3 waits until the official purchase preview predicts at
least 40 total raw Overdrive after the third purchase. A target of 0 permits
purchase at the minimum level. These are not amounts spent: buying an
upgrade **spends skill levels** and creates Overdrive only when bought
above its minimum level. The tool calls the game's exact shared
applyUpgrade model before purchasing.

For safety, checking individual skill boxes alone performs **no writes**.
You must check the explicit level-spending approval and click **Arm
auto-upgrades** each new game/add-on session. Arming is never persisted.
Auto-upgrade control is independent of the live song queue, and sends at
most one authenticated official game upgrade request per 60-second check.
Only the signed-in, matching online character is eligible. When a purchase
is queued behind an active play, the same numbered tier is never requested
again automatically; stop and rearm if server sync fails. Character changes,
server errors and addon unload disarm auto-purchases. The game can finish
a purchase already queued behind the current play even after you press Stop.
**Memory upgrades may forget recorded plays.** No auto-prestige is performed.

**Settings already auto-save** in browser/desktop local storage on that
device; v0.5.4 adds **Save settings now**, **Export settings backup** and
**Import saved settings** under Smart Farm. Export includes skill targets,
skill selections, rate and farming settings, but never account tokens.
Import keeps live queue and auto-upgrade purchasing OFF until re-approved.
Settings are not synced between devices; keep the exported JSON somewhere
private if you want a transferable backup.

## v0.5.5 — Game v1.2.5.0 and guarded live-queue reconnect

The simulator now uses the official game release 1.2.5.0
(commit 7ebe02c6a98a4f9aaeb4a923aacbe6e5dae4e3ff).
Coordination is a physical skill along with Speed, Stamina and Jack Speed:
it is fatigue-adjusted, exempt from Mindblock, and triggers physical-skill
fallback selection when fatigued. The base game's combined warm-up/fatigue
HUD changed, but Smart Farm's strained-minutes input remains manual.

Temporary WebSocket drops now retry at 2, 4, 8, 16 and 30 seconds. Only
the user-approved session can reconnect. The character and *existing*
server-side managed-queue label must match before any further writes.
The initial queue must be acknowledged by the server within 12 seconds;
stale queue snapshots before that acknowledgement no longer falsely
stop management. A genuine external queue change still stops the optimizer.
If disconnected when Stop is pressed, Smart Farm warns that the server
queue could not be cleared. Add-on reloads still require clicking Start
again, and an old server queue can play while the socket is offline.
Auto-upgrade purchase arming remains off after reload.

## Features

- **Skill Improvement:** compare real XP levels and prestige bonuses across all 11 skills using internal scaling and skill formulas.
- **Overdrive (σ):** a streamlined purchase planner with a compact 2×2 status summary and four planned-upgrade cards, now including **plays until planned upgrade**. The estimate uses remaining XP divided by the current boosted XP/play rate. Build settings, medal counts and detailed comparisons remain expandable.
- **Prestige:** see reset effects, permanent bonuses, and the next prestige requirement.
- **Rebirth:** estimate progress toward Overall Lv110.
- **Farming:** separately calculate physical Speed/Stamina/Jack Speed XP with the new strain-based fatigue penalty, Memory XP without Mindblock or fatigue, and other skill XP with Mindblock. Models recovery and projected plays, then applies medal bonuses.
- **Warm-up Planner:** models the official v1.2.2 warm-up curve for Speed, Stamina and Jack Speed. Uses your Stamina upgrade count and current stored strained minutes (shared with Farming), simulates different physical strain percentages and breaks, and compares play count/time to first 100% warm-up. Shows peak window and when resting is optimal after overshooting. Strain shares are estimated; an individual map’s physical strain cannot be known from the add-on’s current local data. Warm-up improves gameplay only, not direct XP.
- **Current stats button:** read a character's saved skill level (including partial XP), upgrades, Overdrive, prestige and overall level from the local game database. Choose the character and skill; no progression writes. For online characters, it also fetches the earned medal list from the game's **public, read-only** character-medals endpoint.
- **Medals:** automatically classify all 148 currently defined medal IDs into Bronze, Silver, Gold, Platinum and Divine tiers when you load an online character. Each medal compounds its XP bonus (0.25%, 0.5%, 1%, 2% and 3% respectively). Manual fallback remains available for guests, offline use and service errors. Unknown future medals are reported, not guessed.
- **New in v0.4.6:** adds five friendship/follower medals (1, 5, 25, 100, 1,000), six mapper medals (1, 2, 5, 10, 50, 100), and two secret medals (fail-10s and parallax). The server awards friend medals for distinct other accounts that add your account (incoming followers), not how many accounts you add. (At v0.4.6, the toolkit had no friend-request feature; v0.4.7 and later have an explicitly approved opt-in Friend Manager.)

## v0.4.8 — Fixing "User not found (HTTP 404)"

An oss!idle **character ID** from the web profile (for example /web/c/123)
is **not** necessarily the account/user ID that the game's Friend API accepts.
In v0.4.7 pasted numeric IDs were assumed to be account IDs, causing avoidable
404 responses on friend adds. v0.4.8 resolves pasted character IDs or official
character-profile links to the owning account through the game's public API
before queueing, and optionally accepts explicitly selected account IDs.
Previously queued IDs are not retained after a restart, so review a new queue.

Before each authenticated add, the manager now verifies the account exists
and skips invalid accounts with a specific error. All requests still require
manually selecting and confirming the batch; no automatic messaging.

## Optional Friend Manager — explicit account actions

The Friend Manager tab is the **only part of the toolkit that changes your account state**.
Everything in the calculators and Discovery remains read-only. This feature is opt-in,
does not begin automatically, and does not send any messages.

1. Open **Friends** and choose **Verify login & refresh friends**. The panel checks your
   signed-in account, displays incoming followers and reads your outgoing friend list.
2. Search specific players by character name. Select the accounts you want, then
   choose **Queue selected players**. You can also paste character-profile links or numeric **character IDs**
   (resolved to account IDs automatically). For true account IDs, change the
   selector to **Account / osu! user ID**.
3. Review the queue (maximum 100 accounts at once) and check the approval box.
   Click **Start adds**. Each outgoing PUT /v1/social/friends/{userId}
   request is at least 6.5 seconds after the previous success — under 10 per minute.
4. **Stop** anytime, or close the toolkit/switch sections to pause the queue.
   A request already in flight can still finish. Refresh before restarting after errors.
5. The tool stops on any API error, including authentication or 429 rate-limit errors;
   there is no automatic retry or way around the game's restrictions.

The only API origin used is the official https://api.oss.idle.rhythmgamers.net.
Requests use your active game session: browser session cookies or the desktop
client's live bearer token (kept in memory for the request and never logged,
stored, or transmitted elsewhere). Search and follower refresh are GET requests.
For pasted character profiles, the toolkit calls GET /v1/characters/{id} to resolve
its owning account ID, and for account IDs calls GET /v1/users/{id}. Before
sending a friend-add PUT it checks the account still exists. Invalid IDs are
skipped with an explanation rather than repeatedly retried. Queued player IDs
are held in memory, not uploaded to another service or stored persistently.
The social PUT requests are sent only after explicit
batch approval. Please respect the game's current community rules and avoid
unwanted interactions. Game/server limits can be stricter than this client's
pacing and always take precedence.

The **Icon** medal counts players who follow **you**, not how many players you follow.
The progress card reports incoming follower thresholds of 1, 5, 25, 100 and 1,000.

## Install and update through GitHub (recommended)

This repository now supports oss!idle's **Built from a git repository** add-on type. The game builds the newest `vX.Y.Z` tag itself, rather than requiring you to paste fresh JavaScript every time.

1. Open **Options → Add-ons → Manage → Create new add-on** and choose **Built from a git repository** (Gameplay type).
2. Enter the public repository URL: **https://github.com/TheoChii/theo-oss-idle-progression-addon**.
3. Save the add-on and copy the **webhook URL generated by oss!idle**.
4. On GitHub, open **Settings → Webhooks → Add webhook** for this repository. Paste that URL as the **Payload URL**; use **application/json**, select **Just the push event**, and keep it active.
5. The repository has a version-tag release at `v0.5.5`. The game should pick up the newest version when its build queue runs. Check the build log and then **install/enable** the built add-on (and submit it for review if the game requires that).

For future updates, commit to `main` and push a **new version tag** (for example `v0.5.6`). Untagged edits to `main` are **not** new releases. The webhook URL belongs to your specific in-game add-on, so do not post it publicly.

### Manual fallback

To install by pasted code instead, build the project locally and paste the **generated** `dist/progression-toolkit.addon.js` ES module (the unbundled source alone will **not** load the Smart Farm simulation). Updating a manually installed draft may require uninstalling/reinstalling **only that toolkit**, not deleting character/game data.

Press **Ctrl+Shift+P** for the original calculators and **Ctrl+Shift+G** for Smart Farm; **Esc** closes the current panel.


## XP input conventions (v0.5.2)

- **Overdrive and Prestige:** `Base skill XP/play` means XP **before** upgrades, Overdrive, prestige and medals; the toolkit multiplies all of these automatically when estimating plays.
- **Rebirth and Farming:** XP/play inputs should be **before medal bonuses**. For Rebirth, include any other boosts already present in your total XP rate. Farming splits the rates into **physical** (Speed, Stamina, Jack Speed), **Memory**, and **other skills**, with any other boosts already included as appropriate.
- If a supplied rate already includes medals, divide it by the displayed medal multiplier first so the bonus is not applied twice.
- When **Use current player stats** loads a cached online character, the add-on requests `GET https://api.oss.idle.rhythmgamers.net/v1/characters/{id}/medals` (public read-only data; no password, token or cookie sent), counts the official medal IDs by tier and saves those counts locally. Guests and failed requests retain a visible manual fallback; unknown future medal IDs are reported. Medal boosts assume no additional medals are earned during a forecast.
- **Warm-up inputs:** The warm-up and fatigue planner share the strained-minute and rest inputs. Stamina upgrades are populated from the cached character when available; other warm-up details remain manual. 40% physical strain represents the game’s full-strain threshold. The planner can show an ideal shorter final map — select a naturally shorter map in reality. Warm-up is assessed at the **start of the next map**, and the theoretical fastest route assumes full physical strain with no breaks. If already past peak warm-up, rest until back within the peak window.
- Fatigue is measured in accumulated **strained minutes**, not ordinary playtime. Fatigue XP loss begins at 300 strained minutes and bottoms out at 420 (5% physical XP retained). Non-strained playtime and idle time recover fatigue at 0.4 minute/minute. The physical note strain percentage is relative to the game model's 40% full-strain threshold; the calculator estimates chart strain from your input rather than inspecting each played chart. Breaks between projected maps are configurable.
- Farming's former combined **exempt XP** value is migrated to the new **physical XP** field for existing saved settings, with Memory defaulted to zero because its share cannot be reconstructed. Review and split these figures manually after updating.
- **Use current player stats** loads a cached **local game database snapshot** and fills level, partial XP, upgrades, Overdrive, prestige and overall level. The public medal lookup runs separately after that. Online progression may not yet be cached. Base XP/play rates and server-held fatigue remain manual. Choose a character/skill, then press the button again to refresh.

## Safety and limitations

- **Calculators and Discovery are read-only.** The optional Friend Manager sends authenticated friend-add requests **only when you manually approve and start a queue**. It never modifies progression, sends messages, or runs friends automation on install. Map links open osu! when clicked.
- Calculators use locally entered numbers and optionally cached read-only local progression. Discovery reads local chart and score metadata. The public medal lookup transmits a numeric public character ID to the game API. The **Friend Manager**, when you enable its actions, sends numeric player account IDs to the game API using the active logged-in session; it does not extract or save secrets or contact third-party services.
- Skill comparisons show modeled gameplay parameters, **not guaranteed score, accuracy, or clear-rate improvements**.
- Game mechanics change over time. Check formulas against the current game before relying on a result.
- Third-party add-ons run in the game page context; review any source before enabling it.

## Development

The add-on is a dependency-free JavaScript ES module exporting `mount()` and `unmount()`. The repository build bundles the simulator worker, its pinned game model, and toolkit into a single self-contained file and validates its syntax. The game builder runs `npm ci --ignore-scripts`, then `npm run build` with no network access during the build.

```sh
npm ci --ignore-scripts
npm run build   # dist/progression-toolkit.addon.js
npm test        # twenty suites
```

Do not commit generated `dist/` files or `node_modules/`: oss!idle rebuilds the version-tagged source itself. The built JavaScript stays readable and does not use runtime dynamic imports or code evaluation.


Formula references: the official game's [upgrades](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/upgrades.ts), [skill-level mapping](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/sim/skills/levelCurve.ts), [skill simulations](https://github.com/oss-idle/oss-idle/tree/main/packages/shared/src/sim/skills), [XP model](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/sim/skills/xp.ts), [physical fatigue](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/fatigue.ts), and [local character schema](https://github.com/oss-idle/oss-idle/blob/main/packages/client/src/db/schema/character.ts).

## License

GNU Affero General Public License v3.0 only. See [LICENSE](LICENSE).

Not affiliated with, sponsored by, or endorsed by the oss!idle developers.
