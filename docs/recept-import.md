# Recepten importeren

Er zijn drie routes. Ze leunen op verschillende mechanismen, dus als de één faalt werkt de ander meestal wel.

| Route | Waar | Werkt als… |
|---|---|---|
| 📷 Foto | Recepten → + → Foto | altijd — er zit niets tussen jouw telefoon en Google |
| 📸 Instagram-link | Recepten → + → Instagram | een publieke CORS-proxy de post kan ophalen |
| 🔗 Deelmenu | iOS Shortcut | de server het bijschrift kan ophalen |

## 📷 Foto-import (meest betrouwbaar)

Screenshot maken en in de app kiezen. Werkt ook als het recept **alleen in beeld** staat en niet in het bijschrift — precies waar link-import principieel faalt.

Werkt net zo goed voor een kookboekpagina, een receptkaart of een screenshot van een blog. Maximaal 6 foto's per recept; die worden als één geheel gelezen. Foto's worden voor verzending teruggeschaald naar maximaal 1280px.

Je kunt een screenshot ook rechtstreeks in het foto-tabblad plakken.

## 🔗 Import vanuit het iOS-deelmenu

Hiermee importeer je een reel zonder de app te openen. De Shortcut stuurt de link naar een Edge Function, die het bijschrift server-side ophaalt (geen CORS, echte User-Agent), Gemini het recept eruit laat halen en het in `recipe_inbox` zet. De app pikt het op bij de volgende sync.

### Stap 1 — de secret zetten (verplicht)

Zonder deze stap geeft de functie *"Geen Gemini API key op de server"*. De app synct zijn eigen key bewust niet mee, dus de server heeft een eigen exemplaar nodig.

Via het dashboard: **supabase.com/dashboard** → je project → **Edge Functions** → tabblad **Secrets** → **Add new secret**

- Naam: `GEMINI_API_KEY`
- Waarde: je Gemini-key (`AIza…`), op te halen bij [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

Zie je dat tabblad niet, dan staat het onder **Project Settings** → **Edge Functions** → **Secrets**. Of via de CLI:

```bash
supabase secrets set GEMINI_API_KEY=AIza... --project-ref nejjocgplgbgmdornurw
```

### Stap 2 — de functie (opnieuw) uitrollen

De secret wordt pas opgepikt bij de eerstvolgende uitrol:

```bash
supabase functions deploy ig-import --project-ref nejjocgplgbgmdornurw
```

### Stap 3 — je household-code ophalen

Open de app → het **wolkje** rechtsboven in de weekbalk → **Kopieer sync code**. Dat is een uuid zoals `3f2a…`. Zorg dat je telefoon en laptop dezelfde code gebruiken, anders komt het recept in het verkeerde huishouden terecht.

### Stap 4 — de Shortcut bouwen

1. Open **Opdrachten** → **+** → tik op de naam bovenin → **Details**
2. Zet **Toon in deelblad** aan, en zet **Deelbladtypen** op alleen **URL's**
3. Voeg de actie **Haal inhoud op van URL** toe en klap **Toon meer** open:
   - **URL**: `https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import`
   - **Methode**: `POST`
   - **Koppen** (twee stuks):
     - `Authorization` → `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko`
     - `Content-Type` → `application/json`
   - **Verzoektekst**: `JSON`, met twee velden:
     - `url` (tekst) → kies **Snelkoppelinginvoer**
     - `household_id` (tekst) → plak je code uit stap 3
4. Voeg **Toon melding** toe met de **Inhoud van URL** eronder, zodat je ziet wat de server antwoordt
5. Noem hem *Recept opslaan*

Let op: de header is `Bearer` **spatie** en dan de sleutel. Die anon key staat sowieso publiek in `index.html`, dus dat is geen geheim.

### Gebruiken

Instagram → reel → **Delen** → **Recept opslaan**. Bij succes verschijnt er een melding als:

```json
{"ok":true,"name":"Romige pasta met tomaat","ingredients":9}
```

Open daarna de app en tik op het wolkje → **Ophalen**. Het recept staat dan bij je eigen recepten.

### Wanneer het niet lukt

De melding vertelt wat er mis is:

| Melding | Wat er aan de hand is |
|---|---|
| `Onbekend huishouden` | De household-code klopt niet, of dit apparaat heeft nog nooit gesynchroniseerd. Open de app één keer en druk op **Opslaan** in het syncvenster. |
| `Geen Gemini API key op de server` | Stap 1 of 2 overgeslagen. |
| `Bijschrift kon niet worden opgehaald` | Instagram blokkeert deze post. Maak een screenshot en gebruik de foto-import in de app. |
| `Geen recept in dit bijschrift gevonden` | Het recept staat in de video of in de reacties, niet in het bijschrift. Ook hier: screenshot. |
| `Gemini-quota is op` | De gratis limiet reset elke dag. |
| Niets, of een 401 | De `Authorization`-header ontbreekt of mist het woord `Bearer`. |

## Beheer

### Gemini-key

De key wordt **bewust niet gesynchroniseerd**. `weekmenu_sync` heeft een `allow_all`-policy en de anon key staat publiek in `index.html`, dus alles in die tabel is leesbaar voor wie ernaar zoekt. Een API-key hoort daar niet in.

Gevolg: je vult de key per apparaat één keer in, bij Recepten → **+** → Instagram of Foto.

Voor de Shortcut-route is de secret daarom **verplicht** — zie stap 1 hierboven. De foto- en link-import in de app zelf werken gewoon zonder secret; die gebruiken de key uit je browser.

### Modelkeuze

De functie vraagt bij elke aanroep aan Google welke modellen die key mag gebruiken, en rangschikt die zelf. Een vaste lijst veroudert: modellen worden teruggetrokken en je krijgt dan *"model is no longer available"*. Beeldgeneratie-, spraak- en embedding-modellen worden eruit gefilterd, want die kunnen dit niet en hebben vaak quota 0.

### Opnieuw deployen

```bash
supabase functions deploy ig-import --project-ref nejjocgplgbgmdornurw
```

### Database

`supabase/migrations/0001_recipe_inbox.sql` maakt de `recipe_inbox`-tabel aan. Die is al toegepast.

De RLS-policy is `allow_all`, net als bij `weekmenu_sync` — je household-code is wat de data beschermt, niet de policy. Deel die code dus alleen met je huisgenoten.
