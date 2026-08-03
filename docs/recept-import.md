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

Hiermee importeer je een reel zonder de app te openen. De Shortcut stuurt de link naar een Edge Function, die het bijschrift server-side ophaalt, Gemini het recept eruit laat halen en het in `recipe_inbox` zet. De app pikt het op bij de volgende sync.

### Eenmalig instellen

Je hebt je **household-code** nodig — die staat in de app onder het ☁️ sync-knopje.

1. Open **Opdrachten** (Shortcuts) op je iPhone → **+**
2. Zet bovenaan **Toon in deelmenu** aan, en zet het invoertype op **URL's**
3. Voeg toe: **Haal inhoud op van URL**
   - URL: `https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import`
   - Methode: **POST**
   - Koppen:
     - `Authorization` → `Bearer <anon key uit index.html>`
     - `Content-Type` → `application/json`
   - Verzoektekst: **JSON**
     - `url` → *Snelkoppelinginvoer*
     - `household_id` → jouw household-code
4. Voeg toe: **Toon melding** met de opgehaalde inhoud, zodat je ziet of het gelukt is
5. Noem hem *Recept opslaan*

### Gebruiken

Instagram → reel → **Delen** → **Recept opslaan**. Open daarna de app en trek omlaag of tik op ⬇ Ophalen; het recept staat er dan bij.

### Wanneer het niet lukt

De functie geeft een leesbare melding terug:

- `Onbekend huishouden` → verkeerde household-code
- `Geen Gemini API key` → vul hem in de app in bij Recepten → Instagram, of zet de secret (hieronder)
- `Bijschrift kon niet worden opgehaald` → Instagram blokkeert deze post; gebruik de foto-import

## Beheer

### Gemini-key

De key wordt **bewust niet gesynchroniseerd**. `weekmenu_sync` heeft een `allow_all`-policy en de anon key staat publiek in `index.html`, dus alles in die tabel is leesbaar voor wie ernaar zoekt. Een API-key hoort daar niet in.

Gevolg: je vult de key per apparaat één keer in, bij Recepten → **+** → Instagram of Foto.

Voor de Shortcut-route is de secret daarom **verplicht** — zonder secret heeft de Edge Function geen key meer:

```bash
supabase secrets set GEMINI_API_KEY=AIza... --project-ref nejjocgplgbgmdornurw
```

Of via het dashboard: Project Settings → Edge Functions → Secrets.

De foto- en link-import in de app zelf werken gewoon zonder secret; die gebruiken de key uit je browser.

### Opnieuw deployen

```bash
supabase functions deploy ig-import --project-ref nejjocgplgbgmdornurw
```

### Database

`supabase/migrations/0001_recipe_inbox.sql` maakt de `recipe_inbox`-tabel aan. Die is al toegepast.

De RLS-policy is `allow_all`, net als bij `weekmenu_sync` — je household-code is wat de data beschermt, niet de policy. Deel die code dus alleen met je huisgenoten.
