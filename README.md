# Theo's oss!idle Progression Toolkit ⚡

An unofficial, experimental in-game progression toolkit add-on for [oss!idle](https://github.com/oss-idle/oss-idle).

**Vibe-coded by Theo with AI assistance.** This project was developed using AI-generated and AI-assisted code, with review and automated tests. Its estimates are not official game guidance.

## Two main sections

- **Calculators:** Skill Improvement, Overdrive, Prestige, Rebirth, and Farming.
- **Discovery:** filter downloaded osu!mania beatmaps to find difficulties with no local score for the selected character. Includes search, max stars, sort order, play count, and a link to the corresponding osu! beatmap page. Discovery is 4K-only, so it does not display a redundant key-mode dropdown.

Discovery uses oss!idle's read-only local SQL database bridge and the downloaded beatmap IndexedDB metadata, as documented in the [official add-on SDK](https://github.com/oss-idle/addon-sdk/blob/master/packages/addon-sdk/README.md). It does **not** contact a live ranked-map catalog, and “no local play found” does not prove the character has never played a chart on another device or before clearing data. Characters are suggested from the latest locally stored score, with a manual selector if that guess is wrong. Select **Refresh** after starting the client or finishing a play.

## Features

- **Skill Improvement:** compare real XP levels and prestige bonuses across all 11 skills using internal scaling and skill formulas.
- **Overdrive (σ):** preview delayed upgrade purchases and XP multipliers, including compounded medal bonuses. The summary still shows plays until unlock, σ from buying now, or the next prestige slot when maxed.
- **Prestige:** see reset effects, permanent bonuses, and the next prestige requirement.
- **Rebirth:** estimate progress toward Overall Lv110.
- **Farming:** separately calculate physical Speed/Stamina/Jack Speed XP with the new strain-based fatigue penalty, Memory XP without Mindblock or fatigue, and other skill XP with Mindblock. Models recovery and projected plays, then applies medal bonuses.
- **Current stats button:** read a character's saved skill level (including partial XP), upgrades, Overdrive, prestige and overall level from the local game database. Choose the character and skill; no progression writes or remote account requests.
- **Medals:** manually enter Bronze, Silver, Gold, Platinum and Divine medal counts. Each earned medal compounds its XP bonus (0.25%, 0.5%, 1%, 2% and 3% respectively); the resulting multiplier stacks separately with upgrades, Overdrive and prestige.

**Only one file needs to be installed:** [`progression-toolkit.addon.js`](progression-toolkit.addon.js). No backend or build process is required.

## Install in oss!idle

1. Open **Options → Add-ons → Manage** and create an add-on draft.
2. Paste the full contents of `progression-toolkit.addon.js` into the game's **Code** editor (version **0.4.2**).
3. Save the draft, then **Install** and **Enable** it.
4. With the game window focused, press **Ctrl+Shift+P** to open or close the toolkit. Press **Esc** to close it.

**Updating an installed private draft:** Saving edited draft code does not automatically replace the installed local copy. Disable and uninstall **only the locally installed toolkit** (do not delete your draft), save the updated code to the draft, then install it again.

## XP input conventions (v0.4.2)

- **Overdrive and Prestige:** `Base skill XP/play` means XP **before** upgrades, Overdrive, prestige and medals; the toolkit multiplies all of these automatically when estimating plays.
- **Rebirth and Farming:** XP/play inputs should be **before medal bonuses**. For Rebirth, include any other boosts already present in your total XP rate. Farming splits the rates into **physical** (Speed, Stamina, Jack Speed), **Memory**, and **other skills**, with any other boosts already included as appropriate.
- If a supplied rate already includes medals, divide it by the displayed medal multiplier first so the bonus is not applied twice.
- Medal counts are saved locally in the toolkit's settings; the calculator does not fetch them from your account. Medal boosts are estimates assuming no new medals are earned during the forecast.
- Fatigue is measured in accumulated **strained minutes**, not ordinary playtime. Fatigue XP loss begins at 300 strained minutes and bottoms out at 420 (5% physical XP retained). Non-strained playtime and idle time recover fatigue at 0.4 minute/minute. The physical note strain percentage is relative to the game model's 40% full-strain threshold; the calculator estimates chart strain from your input rather than inspecting each played chart. Breaks between projected maps are configurable.
- Farming's former combined **exempt XP** value is migrated to the new **physical XP** field for existing saved settings, with Memory defaulted to zero because its share cannot be reconstructed. Review and split these figures manually after updating.
- **Use current player stats** loads only a cached **local game database snapshot** and fills level, partial XP, upgrades, Overdrive, prestige, and overall level. Online changes may not yet be cached. Base XP/play rates, medals and server-held fatigue are not inferred or overwritten. Choose a character/skill, then press the button again to refresh.

## Safety and limitations

- The add-on is **read-only**: it doesn't change character progression or perform gameplay actions. Map links open osu! in a separate browser tab only when clicked.
- Calculators use locally entered numbers and optionally cached read-only local character progression via the stat-fill button. Discovery reads only the game's locally stored character names, score history and downloaded chart metadata to build its lists. No account data is transmitted by the add-on.
- Skill comparisons show modeled gameplay parameters, **not guaranteed score, accuracy, or clear-rate improvements**.
- Game mechanics change over time. Check formulas against the current game before relying on a result.
- Third-party add-ons run in the game page context; review any source before enabling it.

## Development

The add-on is a standalone JavaScript ES module exporting `mount()` and `unmount()`. No bundler or package install is required.

Run the tests using Node.js:

```sh
node --check progression-toolkit.addon.js
node test-addon-hotkey.mjs
node test-skill-improvement.mjs
node test-overdrive-layout.mjs
node test-medal-bonuses.mjs
node test-map-discovery.mjs
node test-fatigue-player-stats.mjs
```

Formula references: the official game's [upgrades](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/upgrades.ts), [skill-level mapping](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/sim/skills/levelCurve.ts), [skill simulations](https://github.com/oss-idle/oss-idle/tree/main/packages/shared/src/sim/skills), [XP model](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/sim/skills/xp.ts), [physical fatigue](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/fatigue.ts), and [local character schema](https://github.com/oss-idle/oss-idle/blob/main/packages/client/src/db/schema/character.ts).

## License

GNU Affero General Public License v3.0 only. See [LICENSE](LICENSE).

Not affiliated with, sponsored by, or endorsed by the oss!idle developers.
