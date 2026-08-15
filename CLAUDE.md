# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Weekmenu Planner** — a Dutch-language single-page meal planning web app for a family of three: Shelley (pregnant), Dirk (losing weight), and Maeve (2 years old). The app plans breakfast, lunch, dinner, and snacks per person per day, auto-generates a shopping list, and supports exporting the week plan as an image or PDF.

## Running the app

No build system. Open `index.html` directly in a browser:

```bash
open index.html          # macOS
xdg-open index.html      # Linux
```

There are no dependencies to install, no build step, and no dev server required. All CSS, JavaScript, and HTML are in a single file.

## Architecture

Everything lives in `index.html`. The structure within the `<script>` block:

| Section | What it does |
|---|---|
| `CONFIG` | Constants: `DAYS`, `PEOPLE`, `ROWS`, `BOOD_CATS`, `EC`/`EL`, `TIJD_OPTIES` |
| `RECIPES` | ~142 built-in recipes defined with factory functions `r(id,ebook,name,cat,time,ing,steps,srv,voor)` and `i(name,amount)` |
| `STATE & STORAGE` | Global state `S`, `lsGet`/`lsSet` wrappers, `save()`, `set(patch)` |
| `HELPERS` | `shuf`, `scaleAmt`, `esc`, `toast`, `avatarStack` |
| `ICONEN` | `ICONS` map of drawn 24×24 SVG paths + `ic(name,size)`. No emoji anywhere in the UI — they are not an icon system |
| `DAGINSTELLINGEN` | `dayCfgAt`/`dayCfg`/`setDayCfg`, `rowsFor`, `clearDay` — per-day plan / apart / maxTijd |
| `INGREDIËNTEN` | `ingKey` (normaliseert een naam), `ingKeys` (per recept) — basis voor het hergebruik in de generator |
| `WAARDERINGEN` | `rateOf`, `setRating`, `rateScore`, `rateBadge` |
| `RESTJES` | `makeLeftover`, `isLeftover`, `leftoverCounts`, `leftoverSources` |
| `ACTIONS` | `pickSlot`, `assignRecipe`, `clearSlot`, `saveCustomRecipe`, `boodschappen`, `runAutofill`, `exportImg`, `doImport` (IG/Gemini), `saveForm` |
| `KOOKMODUS` | `openCook`/`closeCook`, `cookGo`, `stepSeconds`, `cookStartTimer`, `renderCookMode` |
| `RENDER` | `render()` + per-view/modal render functions (`renderPlanner`, `renderRecepten`, `renderSnacks`, `renderBoodschappen`, `renderPicker`, `renderDetail`, `renderLeftoverPick`, `renderAddSheet`, `renderWizard`) |

### State management pattern

```js
// Single global state object
let S = { view, activeDay, week, custom, notes, checked, cfg, ... };

// Mutations always go through set():
function set(patch) { Object.assign(S, patch); save(); render(); }

// render() fully replaces app innerHTML on every state change
function render() { document.getElementById("app").innerHTML = `...`; }
```

### Data model

- `S.week` — object keyed by day (`ma`–`zo`), then by row id (e.g. `diner`, `lunch_shelley`). Each value is a recipe object or `null`.
- `S.custom` — user-added recipes (persisted to `localStorage` key `wm_custom_v2`)
- `S.cfg.apartEten` — the household default for eating separately, toggled in the planner's week column. `dayCfgAt` falls back to it for any day that has no explicit `apart` value, so a per-day choice always wins. A one-time migration (`wm_apart_migrated_v1`) turns it on for anyone whose stored weeks contain a genuinely split breakfast or lunch, so upgrading does not silently hide Dirk's meal.
- `S.dayCfg` — per-day settings for the week being viewed, persisted to `wm_daycfg_YYYY-MM-DD`: `{plan, apart, maxTijd}`. `plan` defaults to true, `apart` falls back to `S.cfg.apartEten`, `maxTijd` is `0|15|30|45` (0 = no limit). Read it through `dayCfgAt(wo,day)`, never directly — it resolves the defaults and reads other weeks from localStorage. There are no cooking modes any more.
- `ROWS` — 8 rows; each has `id`, `cat`, `who`, and optionally `sub`, `free`, `apart`. **Which rows a day actually has is `rowsFor(day, wo)`, not `ROWS`** — rows with `apart:true` (`ontbijt_dirk`, `lunch_dirk`) only exist on days where separate eating is on, and `free:true` (`snack_avond`) is a text field, not a slot. So a day has 5 fillable slots normally and 7 when eating separately. Everything that counts slots — stats, dots, shopping list, generator — must go through `rowsFor`.
- `S.ratings` — `{[rcId]: {shelley:1|-1, dirk:…, maeve:…}}`, persisted to `wm_ratings_v1`. Two thumbs down and the generator skips the recipe.
- **Leftovers** — a leftover slot is a reference, not a copy: `{id:"lo_<srcId>", leftoverOf:<srcId>, ingredients:[]}`. `boodschappen()` therefore skips it and instead multiplies the source recipe's amounts by `1 + aantal restjesdagen`.

### The week generator

`wizGenPreview(force)` scores candidates instead of drawing blindly from a shuffled pile (`genScore` / `genTake` / `genPool`):

- ingredient overlap with what's already planned `+1.3` per shared ingredient, `−0.35` per new one (toggle: `S.wiz.reuse`)
- recipes eaten in the last 4 weeks `−1.6` each (`recentlyUsed`) — without this the reuse scoring returns the same week every week
- ratings `±2.5` per thumb, `−50` at two thumbs down (toggle: `S.wiz.useRatings`)
- `−100` for anything already used this week, so a week never repeats itself
- the winner is drawn at random from the top 3, otherwise every week would be identical

Days that are off (`plan:false`) are skipped entirely; `maxTijd` filters the candidate pool by `parseInt(rc.time)` but falls back to the full pool rather than leaving a slot empty.

Slots can be pinned (`S.wiz.locks`, keyed `"<wo>_<day>_<rowId>"`); pinned slots survive regeneration and count as context for the rest of the week. The wizard opens **on the generated proposal** (`wizStart()` → step 4); steps 1–2 are refinements you reach from there (days & generator options, then fixed meals), step 5 is the in-huis check. Step 3 no longer exists.

Measured over 8 consecutive weeks (before the mealprep slot was dropped): ~93 unique ingredients per week with reuse on vs ~111 off, 36 unique dinners across those weeks, 4/49 dinners repeated from the week before, 0 repeats within a week.

### Key constants

- `HH = 3` — household size used to scale recipe ingredient amounts via `scaleAmt()`
- `DAYS = ["ma","di","wo","do","vr","za","zo"]`
- `PEOPLE = { shelley, dirk, maeve }` each with `label`, `sub`, `color` (CSS var), `initial`
- localStorage keys: `wm_week_YYYY-MM-DD`, `wm_notes_YYYY-MM-DD` and `wm_daycfg_YYYY-MM-DD` (keyed by that week's Monday), `wm_custom_v2`, `wm_check_v2`, `wm_cfg_v2`, `wm_ratings_v1`, `wm_snackavond_v1`, `wm_boodOver_v1`, `wm_geminikey_v1` and `wm_theme_v1` (both device-local, never synced)

### External dependencies (CDN, no npm)

- `html2canvas` — screenshot the planner for image export
- `jsPDF` — PDF export
- Google Fonts: Bricolage Grotesque, Hanken Grotesk, Space Mono, Instrument Serif
- **Anthropic Claude API** — called directly from the browser in `doImport()` to extract recipes from Instagram captions. Requires an API key; the user must supply it (there's no backend).

### CSS design tokens

All colors are OKLCH custom properties on `:root`. Roles, not names: `--canvas`/`--surface`/`--surface-2`/`--surface-3`, `--line`/`--line-2`, `--ink`/`--ink-2`/`--ink-3`, one `--accent` (+`-hover`/`-on`/`-soft`/`-line`), semantics `--ok`/`--warn`/`--err`, and the three people as *data* hues `--p-shelley`/`--p-dirk`/`--p-maeve`. Type scale `--t-2xs … --t-3xl` (fixed rem, ratio ~1.2), spacing `--s-1 … --s-10`, radii `--r-*`. Never hardcode a hex.

Rules this stylesheet holds itself to (from the `impeccable` craft floor):

- **no emoji as icons** — use `ic("name")`
- **no eyebrow/kicker above a heading** — the heading carries itself
- **no colored `border-left` over 1px** on cards or rows
- **no stack of identical icon+heading+text cards** as page structure — the day view is a list with hairlines
- monospace (`--num`) only for measurement: times, dates, counts, quantities — with `tabular-nums`
- browser surfaces are themed: `::selection`, `caret-color`, `:focus-visible`, scrollbars
- every interactive element has hover / focus / active / disabled

### Themes

Three states, per the token pattern: bare `:root` carries the complete light palette, `@media (prefers-color-scheme:dark)` guarded as `:root:not([data-theme="light"])` redefines **only the tokens**, and `:root[data-theme="dark"]` redefines them again so an explicit choice wins in both directions. Never declare a color solely inside a media or `[data-theme]` block — it would not apply in the un-stamped "system" state.

`S` does not hold the theme; `wm_theme_v1` does (`auto` | `light` | `dark`), applied by `applyTheme()` before the first render. The dark palette is composed, not inverted: accents move *up* in lightness so they still read on a dark ground, and `--on-person` flips from white to near-black because the person hues get lighter.

Measured with a canvas-based sRGB conversion (`scratchpad/dark.js`) across eleven foreground/background pairs: both themes pass WCAG AA on all of them.

### Responsive

One breakpoint that matters: **900px**. Below it, bottom nav and one day at a time. Above it, the nav becomes a left sidebar and `.planner` becomes a two-column grid — week rail plus summary on the left (`.railcol`, sticky), the selected day on the right. `.railcol{display:contents}` on mobile so the single "Plan de week" button can be reordered instead of duplicated. A second breakpoint at 1280px widens the content and the rail. `.meal` switches to a stacked grid under 560px so the slot label sits above the recipe name.

## Adding or editing recipes

Built-in recipes use the `r()` factory. To add a new one, append to the `RECIPES` array:
```js
r(id, ebook, "Name", "category", "time", [i("ingredient","amount"), ...], ["step 1", ...], servings, "voor")
```
- `category`: `"ontbijt"` | `"lunch"` | `"diner"` | `"tussendoortje"` | `"weekendsnack"` (die laatste heeft een eigen tab en loopt niet mee in het weekmenu of de boodschappenlijst)
- `voor`: `"dirk"` | `"shelley"` | `"beiden"`
- `ebook`: 1–7 for existing ebooks, `0` for custom recipes
- `id`: must be unique across the array
