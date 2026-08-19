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

## De keten

1. **Haal URL's uit invoer** — vist de link uit wat het deelpaneel aanlevert
2. **Tekst** — die link als gewone tekenreeks
3. **Haal inhoud op van URL** — POST naar `ig-import` met `url` en `household_id`
4. **Toon resultaat**

De opdracht haalt zelf niets van Instagram: dat doet de Edge Function.

## Wat er eerder misging

- **Het User-Agent-kenmerk, niet het IP.** Ik concludeerde dat Instagram
  datacenter-IP's weert en verplaatste het ophalen naar de telefoon. Dat klopte
  niet. `ig-probe` mat het na: met een desktop-Chrome-kenmerk komt er een pagina
  zonder bijschrift terug, met een iPhone-Safari-kenmerk het volledige
  bijschrift — vanaf dezelfde server, in ~600 ms. Alle omwegen daarna waren
  overbodig.
- **Het deelpaneel levert RTF, geen URL.** Daarop breekt elke URL-actie af met
  *"kon RTF-tekst niet omzetten in URL"*, en noch `detect.text` noch de
  Tekst-actie krijgt die opmaak eraf. Wat wel werkt:
  `WFWorkflowInputContentItemClasses` beperken tot `WFURLContentItem`, zodat iOS
  zelf omzet, plus `detect.link` om de URL eruit te vissen.

## Meten

`ig-probe` legt veertien routes naar hetzelfde bijschrift naast elkaar en
rapporteert per route status, bytes en of er een bijschrift uit te halen viel:

```
POST /functions/v1/ig-probe   {"url":"https://www.instagram.com/reel/..."}
```

Gebruik dat bij twijfel, in plaats van te gissen.
