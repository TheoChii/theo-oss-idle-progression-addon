# Theo's oss!idle Progression Toolkit ⚡

An unofficial, experimental in-game progression calculator add-on for [oss!idle](https://github.com/oss-idle/oss-idle).

**Vibe-coded by Theo with AI assistance.** This project was developed using AI-generated and AI-assisted code, with review and automated tests. Its estimates are not official game guidance.

## Features

- **Skill Improvement:** compare real XP levels and prestige bonuses across all 11 skills using internal scaling and skill formulas.
- **Overdrive (σ):** preview delayed upgrade purchases and XP multipliers.
- **Prestige:** see reset effects, permanent bonuses, and the next prestige requirement.
- **Rebirth:** estimate progress toward Overall Lv110.
- **Farming:** estimate experience rates and the Mindblock penalty.

**Only one file needs to be installed:** [`progression-toolkit.addon.js`](progression-toolkit.addon.js). No backend or build process is required.

## Install in oss!idle

1. Open **Options → Add-ons → Manage** and create an add-on draft.
2. Paste the full contents of `progression-toolkit.addon.js` into the game's **Code** editor (version **0.3.1**).
3. Save the draft, then **Install** and **Enable** it.
4. With the game window focused, press **Ctrl+Shift+P** to open or close the toolkit. Press **Esc** to close it.

**Updating an installed private draft:** Saving edited draft code does not automatically replace the installed local copy. Disable and uninstall **only the locally installed toolkit** (do not delete your draft), save the updated code to the draft, then install it again.

## Safety and limitations

- The add-on is **read-only**: it doesn't change character progression or perform gameplay actions.
- Calculations use locally entered values; the add-on does not fetch account data or send it over a network.
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
```

Formula references: the official game's [upgrades](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/upgrades.ts), [skill-level mapping](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/sim/skills/levelCurve.ts), [skill simulations](https://github.com/oss-idle/oss-idle/tree/main/packages/shared/src/sim/skills), and [XP model](https://github.com/oss-idle/oss-idle/blob/main/packages/shared/src/sim/skills/xp.ts).

## License

GNU Affero General Public License v3.0 only. See [LICENSE](LICENSE).

Not affiliated with, sponsored by, or endorsed by the oss!idle developers.
