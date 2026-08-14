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
| `CONFIG` | Constants: `DAYS`, `PEOPLE`, `ROWS`, `BOOD_CATS`, `THUMB`, `EC`/`EL` |
| `RECIPES` | ~142 built-in recipes defined with factory functions `r(id,ebook,name,cat,time,ing,steps,srv,voor)` and `i(name,amount)` |
| `STATE & STORAGE` | Global state `S`, `lsGet`/`lsSet` wrappers, `save()`, `set(patch)` |
| `HELPERS` | `shuf`, `scaleAmt`, `esc`, `toast`, `avatarStack` |
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

- `S.week` — object keyed by day (`ma`–`zo`), then by row id (e.g. `diner`, `lunch_dirk`). Each value is a recipe object or `null`.
- `S.custom` — user-added recipes (persisted to `localStorage` key `wm_custom_v2`)
- `S.cfg.cookDays` — per-day cooking mode: `"cook"` | `"rest"` | `"none"`
- `ROWS` — defines the 8 meal slots per day; each has `id`, `cat` (ontbijt/lunch/diner/tussendoortje), `who` (dirk/shelley/samen), `split`. A row with `free:true` (`snack_avond`) is a free-text field, not a recipe slot: it is excluded from stats, the shopping list and the generator, so only 7 slots are fillable.
- `S.ratings` — `{[rcId]: {shelley:1|-1, dirk:…, maeve:…}}`, persisted to `wm_ratings_v1`. Two thumbs down and the generator skips the recipe.
- **Leftovers** — a leftover slot is a reference, not a copy: `{id:"lo_<srcId>", leftoverOf:<srcId>, ingredients:[]}`. `boodschappen()` therefore skips it and instead multiplies the source recipe's amounts by `1 + aantal restjesdagen`.

### The week generator

`wizGenPreview(force)` scores candidates instead of drawing blindly from a shuffled pile (`genScore` / `genTake` / `genPool`):

- ingredient overlap with what's already planned `+1.3` per shared ingredient, `−0.35` per new one (toggle: `S.wiz.reuse`)
- recipes eaten in the last 4 weeks `−1.6` each (`recentlyUsed`) — without this the reuse scoring returns the same week every week
- ratings `±2.5` per thumb, `−50` at two thumbs down (toggle: `S.wiz.useRatings`)
- `−100` for anything already used this week, so a week never repeats itself
- the winner is drawn at random from the top 3, otherwise every week would be identical

Slots can be pinned (`S.wiz.locks`, keyed `"<wo>_<day>_<rowId>"`); pinned slots survive regeneration and count as context for the rest of the week. The wizard opens **on the generated proposal** (`wizStart()` → step 4); steps 1–3 are refinements you reach from there, step 5 is the in-huis check.

Measured over 8 consecutive weeks: ~93 unique ingredients per week with reuse on vs ~111 off, 36 unique dinners across those weeks, 4/49 dinners repeated from the week before, 0 repeats within a week.

### Key constants

- `HH = 3` — household size used to scale recipe ingredient amounts via `scaleAmt()`
- `DAYS = ["ma","di","wo","do","vr","za","zo"]`
- `PEOPLE = { shelley, dirk, maeve }` each with `label`, `sub`, `color` (CSS var), `initial`
- localStorage keys: `wm_week_YYYY-MM-DD` and `wm_notes_YYYY-MM-DD` (keyed by that week's Monday), `wm_custom_v2`, `wm_check_v2`, `wm_cfg_v2`, `wm_ratings_v1`, `wm_snackavond_v1`, `wm_boodOver_v1`, `wm_geminikey_v1` (never synced)

### External dependencies (CDN, no npm)

- `html2canvas` — screenshot the planner for image export
- `jsPDF` — PDF export
- Google Fonts: Bricolage Grotesque, Hanken Grotesk, Space Mono, Instrument Serif
- **Anthropic Claude API** — called directly from the browser in `doImport()` to extract recipes from Instagram captions. Requires an API key; the user must supply it (there's no backend).

### CSS design tokens

Defined as CSS custom properties on `:root`. Color names like `--terra`, `--olive`, `--honey`, `--amber` map to the three people's brand colors (`--shelley`, `--dirk`, `--maeve`). Always use these vars rather than hardcoded hex.

## Adding or editing recipes

Built-in recipes use the `r()` factory. To add a new one, append to the `RECIPES` array:
```js
r(id, ebook, "Name", "category", "time", [i("ingredient","amount"), ...], ["step 1", ...], servings, "voor")
```
- `category`: `"ontbijt"` | `"lunch"` | `"diner"` | `"tussendoortje"` | `"weekendsnack"` (die laatste heeft een eigen tab en loopt niet mee in het weekmenu of de boodschappenlijst)
- `voor`: `"dirk"` | `"shelley"` | `"beiden"`
- `ebook`: 1–7 for existing ebooks, `0` for custom recipes
- `id`: must be unique across the array
