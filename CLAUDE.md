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
| `ACTIONS` | `pickSlot`, `assignRecipe`, `clearSlot`, `saveCustomRecipe`, `boodschappen`, `runAutofill`, `exportImg`, `doImport` (IG/Claude API), `saveForm` |
| `RENDER` | `render()` + per-view/modal render functions (`renderPlanner`, `renderRecepten`, `renderBoodschappen`, `renderPicker`, `renderDetail`, `renderAddSheet`, `renderWizard`) |

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
- `ROWS` — defines the 7 meal slots per day; each has `id`, `cat` (ontbijt/lunch/diner/tussendoortje), `who` (dirk/shelley/samen), `split`

### Key constants

- `HH = 3` — household size used to scale recipe ingredient amounts via `scaleAmt()`
- `DAYS = ["ma","di","wo","do","vr","za","zo"]`
- `PEOPLE = { shelley, dirk, maeve }` each with `label`, `sub`, `color` (CSS var), `initial`
- localStorage keys: `wm_week_v2`, `wm_custom_v2`, `wm_notes_v2`, `wm_check_v2`, `wm_cfg_v2`

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
- `category`: `"ontbijt"` | `"lunch"` | `"diner"` | `"tussendoortje"`
- `voor`: `"dirk"` | `"shelley"` | `"beiden"`
- `ebook`: 1–7 for existing ebooks, `0` for custom recipes
- `id`: must be unique across the array
