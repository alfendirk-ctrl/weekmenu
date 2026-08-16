# Recepten importeren

Er zijn drie routes. Ze leunen op verschillende mechanismen, dus als de één faalt werkt de ander meestal wel.

| Route | Waar | Werkt als… |
|---|---|---|
| Foto | Recepten → + → Foto | altijd — er zit niets tussen jouw telefoon en Google |
| Instagram-link | Recepten → + → Instagram | een publieke CORS-proxy de post kan ophalen |
| Deelmenu | iOS Shortcut | de telefoon het bijschrift kan ophalen |

## Foto-import (meest betrouwbaar)

Screenshot maken en in de app kiezen. Werkt ook als het recept **alleen in beeld** staat en niet in het bijschrift — precies waar link-import principieel faalt.

Werkt net zo goed voor een kookboekpagina, een receptkaart of een screenshot van een blog. Maximaal 6 foto's per recept; die worden als één geheel gelezen. Foto's worden voor verzending teruggeschaald naar maximaal 1280px.

Je kunt een screenshot ook rechtstreeks in het foto-tabblad plakken.

## Import vanuit het iOS-deelmenu

Hiermee importeer je een reel zonder de app te openen. De Shortcut haalt het bijschrift op **vanaf je telefoon** en stuurt dat naar een Edge Function, die Gemini het recept eruit laat halen en het in `recipe_inbox` zet. De app pikt het op bij de volgende sync.

> **Waarom de telefoon het bijschrift ophaalt.** Dat deed de server eerst zelf, maar Instagram blokkeert de datacenter-IP's waar Edge Functions op draaien: elke post gaf *"Bijschrift kon niet worden opgehaald"*, ook publieke. Vanaf je eigen verbinding lukt het meestal wel. De functie accepteert daarom zowel `caption` als `url` — is er een bijschrift meegestuurd, dan gaat dat voor; is dat er niet, dan probeert de server het alsnog zelf. `caption` mag ook de **ruwe HTML** van de pagina zijn: de server herkent HTML en haalt het bijschrift er zelf uit, zodat de Shortcut niets hoeft uit te pluizen.

### Stap 1 — de secret (staat al goed)

De functie heeft een eigen Gemini-key nodig; de app synct die van jou bewust niet mee. De secret `GEMINI_API_KEY` **is gezet en getest** — een testaanroep gaf een compleet recept terug. Moet hij ooit vervangen worden:

**supabase.com/dashboard** → je project → **Edge Functions** → tabblad **Secrets** → **Add new secret**, naam `GEMINI_API_KEY`, waarde je key (`AIza…`) van [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Zie je dat tabblad niet, kijk dan onder **Project Settings** → **Edge Functions** → **Secrets**. Of via de CLI:

```bash
supabase secrets set GEMINI_API_KEY=AIza... --project-ref nejjocgplgbgmdornurw
```

### Stap 2 — de functie uitrollen (staat al goed)

Een nieuwe secret wordt pas opgepikt bij de eerstvolgende uitrol. De huidige versie draait al:

```bash
supabase functions deploy ig-import --project-ref nejjocgplgbgmdornurw
```

### Stap 3 — je household-code ophalen

Open de app → het **wolkje** rechtsboven in de weekbalk → **Kopieer sync code**. Dat is een uuid zoals `3f2a…`. Zorg dat je telefoon en laptop dezelfde code gebruiken, anders komt het recept in het verkeerde huishouden terecht.

### Stap 4 — de Shortcut bouwen

Drie acties. Je telefoon haalt de pagina op, stuurt hem ruw door, en de server pluist hem uit — dat uitpakken staat daar toch al (vijf strategieën), dus de Shortcut hoeft geen regex te kennen.

Open **Opdrachten** → **+**, tik op de naam bovenin → **Naam wijzig** en noem hem *Recept opslaan*.

Tik dan onderin op **ⓘ** (het rondje met een i) en zet **Toon in deelblad** aan. Op iOS 16 en ouder zit datzelfde paneel achter het schuifjes-icoon rechtsboven, onder **Details**; vanaf iOS 17 is het naar de balk onderin verhuisd.

Zodra die schakelaar aanstaat verschijnt er bovenaan je opdracht een blok *"Ontvang tekst en 17 andere invoer van deelblad"*. Tik op de blauwe tekst *tekst en 17 andere* en vink alles uit behalve **URL's** en **Tekst**.

**Actie 1 — Vervang tekst.** Dit knipt de tracking-rommel (`?igsh=…`) van de gedeelde link.

- **Zoek naar**: `\?.*$` — tik op de drie puntjes rechts en zet **Reguliere expressie** aan
- **Vervang door**: leeg laten
- **In**: **Snelkoppelinginvoer** (kies je via de variabelenbalk boven het toetsenbord)

**Actie 2 — Haal inhoud op van URL.** Je telefoon haalt de embed-pagina op; Instagram laat dat vanaf jouw verbinding wél toe.

- **URL**: tik het veld, kies **Bijgewerkte tekst** (het resultaat van actie 1) en typ er direct achter: `embed/captioned/`
- Klap **Toon meer** open, **Methode** blijft `GET`, en voeg één **kop** toe:
  - `User-Agent` → `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`

**Actie 3 — Haal inhoud op van URL.** De aanroep zelf.

- **URL**: `https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import`
- **Methode**: `POST`
- **Koppen** (twee stuks):
  - `Authorization` → `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko`
  - `Content-Type` → `application/json`
- **Verzoektekst**: `JSON`, drie velden van het type **Tekst**:
  - `caption` → **Inhoud van URL** (het resultaat van actie 2)
  - `url` → **Snelkoppelinginvoer**
  - `household_id` → je code uit stap 3

Zet er tot slot **Toon melding** onder met **Inhoud van URL**, dan zie je wat de server antwoordt.

Let op: de header is `Bearer` **spatie** en dan de sleutel. Die anon key staat sowieso publiek in `index.html`, dus dat is geen geheim.

Belangrijk bij actie 3: de twee **Inhoud van URL**-variabelen verwijzen naar verschillende acties. Tik je de verkeerde aan, dan stuurt de Shortcut zijn eigen antwoord terug naar zichzelf. Controleer dat `caption` naar actie 2 wijst.

Het `caption`-veld mag ruwe HTML zijn; de server herkent dat en pakt het bijschrift eruit. Geplakte tekst mag ook — deel je een stuk tekst in plaats van een link, dan gaat die er ongewijzigd in.

### Gebruiken

Instagram → reel → **Delen** → **Recept opslaan**. Bij succes verschijnt er een melding als:

```json
{"ok":true,"name":"Romige pasta met spinazie en zongedroogde tomaat","ingredients":9}
```

Open daarna de app en tik op het wolkje → **Ophalen**. Het recept staat dan bij je eigen recepten.

### Wanneer het niet lukt

De melding vertelt wat er mis is:

| Melding | Wat er aan de hand is |
|---|---|
| `Onbekend huishouden` | De household-code klopt niet, of dit apparaat heeft nog nooit gesynchroniseerd. Open de app één keer en druk op **Opslaan** in het syncvenster. |
| `url of caption ontbreekt` | Actie 3 stuurt lege JSON-velden mee. Controleer of de variabelen er echt in staan. |
| `Geen Gemini API key op de server` | De secret uit stap 1 is weg of de functie is daarna niet opnieuw uitgerold. |
| `Bijschrift kon niet worden opgehaald` | Actie 2 leverde niets bruikbaars op — en de server komt er zelf ook niet bij. Maak een screenshot en gebruik de foto-import in de app. |
| `Geen recept in dit bijschrift gevonden` | Het recept staat in de video of in de reacties, niet in het bijschrift. Ook hier: screenshot. |
| `Gemini-quota is op` | De gratis limiet reset elke dag. |
| Niets, of een 401 | De `Authorization`-header ontbreekt of mist het woord `Bearer`. |

## Beheer

### Gemini-key

De key wordt **bewust niet gesynchroniseerd**. `weekmenu_sync` heeft een `allow_all`-policy en de anon key staat publiek in `index.html`, dus alles in die tabel is leesbaar voor wie ernaar zoekt. Een API-key hoort daar niet in.

Gevolg: je vult de key per apparaat één keer in, bij Recepten → **+** → Instagram of Foto.

Voor de Shortcut-route is de secret daarom **verplicht** — zie stap 1 hierboven. De foto- en link-import in de app zelf werken gewoon zonder secret; die gebruiken de key uit je browser.

### Waarom de server het bijschrift niet zelf ophaalt

Getest op 16 augustus 2026, rechtstreeks tegen de uitgerolde functie: drie verschillende publieke posts, alle drie `422 Bijschrift kon niet worden opgehaald`. De functie probeert vijf strategieën op drie URL's (embed-captioned, embed, de post zelf) met een echte browser-User-Agent; Instagram weigert ze allemaal vanaf datacenter-IP's. Dezelfde functie met een meegestuurd bijschrift gaf `200` en een compleet recept: naam, categorie `diner`, `25 min`, 4 personen, 9 ingrediënten met losse hoeveelheden, 5 stappen.

De server-fetch blijft erin staan als terugval — het kost niets en werkt mogelijk wél voor sommige posts — maar reken erop dat de telefoon het bijschrift aanlevert.

### Modelkeuze

De functie vraagt bij elke aanroep aan Google welke modellen die key mag gebruiken, en rangschikt die zelf. Een vaste lijst veroudert: modellen worden teruggetrokken en je krijgt dan *"model is no longer available"*. Beeldgeneratie-, spraak- en embedding-modellen worden eruit gefilterd, want die kunnen dit niet en hebben vaak quota 0.

### Opnieuw deployen

```bash
supabase functions deploy ig-import --project-ref nejjocgplgbgmdornurw
```

### Database

`supabase/migrations/0001_recipe_inbox.sql` maakt de `recipe_inbox`-tabel aan. Die is al toegepast.

De RLS-policy is `allow_all`, net als bij `weekmenu_sync` — je household-code is wat de data beschermt, niet de policy. Deel die code dus alleen met je huisgenoten.
