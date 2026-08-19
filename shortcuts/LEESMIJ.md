# Recept opslaan — iOS Shortcut

`Recept opslaan.shortcut` wordt gegenereerd door `bouw.js`:

```
node bouw.js "Recept opslaan.shortcut"
```

Pas in `bouw.js` de constanten `HH`, `FN` en `ANON` aan als het huishouden of
het project verandert.

## Installeren

iOS weigert niet-ondertekende opdrachtbestanden ronduit — "Onbetrouwbare
opdrachten toestaan" bestaat niet meer. Ondertekenen kan alleen op een Mac:

```
shortcuts sign -m anyone -i "Recept opslaan.shortcut" -o "Recept opslaan 2.shortcut"
```

Dubbelklik het resultaat, en deel het vanuit Opdrachten op de Mac als
iCloud-link. Die link openen op de iPhone installeert hem wél.

## De keten, en waarom hij zo is

1. **Tekst** — de gedeelde link, ontdaan van opmaak
2. **Vervang tekst** — knipt `?igsh=…` eraf
3. **Haal inhoud op van URL** — GET op `<link>embed/captioned/`
4. **Tekst** — de opgehaalde pagina, ontdaan van opmaak
5. **Haal inhoud op van URL** — POST naar `ig-import` met `caption`, `url` en
   `household_id`
6. **Toon resultaat**

Drie dingen die eerder misgingen en die deze opbouw afvangt:

- **Het ophalen moet vanaf de telefoon.** Instagram weigert datacenter-IP's, en
  sinds augustus 2026 ook de publieke CORS-proxy's waar `index.html` op leunt.
  De Edge Function komt er dus niet bij; Safari op de iPhone wel.
- **Alles moet door een Tekst-actie.** Het deelblad levert de link als
  attributed string aan. Zowel "Vervang tekst" als "Haal tekst op uit" houden
  die opmaak vast, waarna de URL-actie afbreekt met *"kon RTF-tekst niet
  omzetten in URL"*. `is.workflow.actions.gettext` platst het wel.
- **Geen User-Agent-koptekst.** Safari haalt dezelfde pagina op met zijn eigen
  kenmerk; een desktop-Chrome-regel vanaf een telefoon leest Instagram eerder
  als bot.

`ig-import` accepteert zowel ruwe HTML als platte tekst in `caption`, dus het
maakt niet uit welke van de twee de Tekst-actie oplevert.
