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

1. **Haal URL's uit invoer** — vist de link uit wat het deelpaneel aanlevert
2. **Tekst** — die link als gewone tekenreeks
3. **Vervang tekst** — knipt `?igsh=…` eraf
4. **Haal inhoud op van URL** — GET op `<link>embed/captioned/`
5. **Tekst** — de opgehaalde pagina, ontdaan van opmaak
6. **Haal inhoud op van URL** — POST naar `ig-import` met `caption`, `url` en
   `household_id`
7. **Toon resultaat**

Drie dingen die eerder misgingen en die deze opbouw afvangt:

- **Het ophalen moet vanaf de telefoon.** Instagram weigert datacenter-IP's, en
  sinds augustus 2026 ook de publieke CORS-proxy's waar `index.html` op leunt.
  De Edge Function komt er dus niet bij; Safari op de iPhone wel.
- **Het deelpaneel levert RTF aan, geen URL.** Daarop breekt de URL-actie af
  met *"kon RTF-tekst niet omzetten in URL"*. Noch "Haal tekst op uit"
  (`detect.text`) noch de Tekst-actie krijgt die opmaak eraf. Wat wel werkt:
  `WFWorkflowInputContentItemClasses` beperken tot `WFURLContentItem`, zodat iOS
  zelf omzet, plus `is.workflow.actions.detect.link` vooraan om de URL eruit te
  vissen. De Tekst-actie erna maakt er een gewone tekenreeks van.
- **Geen User-Agent-koptekst.** Safari haalt dezelfde pagina op met zijn eigen
  kenmerk; een desktop-Chrome-regel vanaf een telefoon leest Instagram eerder
  als bot.

`ig-import` accepteert zowel ruwe HTML als platte tekst in `caption`, dus het
maakt niet uit welke van de twee de Tekst-actie oplevert.
