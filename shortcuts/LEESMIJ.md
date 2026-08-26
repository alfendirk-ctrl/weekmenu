# Recept opslaan — iOS Shortcut

`weekmenu-deel-v7.shortcut` wordt gegenereerd door `bouw.py`:

```
python3 bouw.py "weekmenu-deel-v8.shortcut"
```

Het bestand is een **binair** plist, want dat is wat Opdrachten zelf uitgeeft.
De eerdere generator schreef XML; dat is te lezen maar niet overal geaccepteerd
bij het importeren.

**Geef elke versie een eigen bestandsnaam.** Bij een gelijke naam bewaart macOS
de download als `naam-1`, `naam-2` en zo verder, terwijl `shortcuts sign` de
oorspronkelijke naam blijft ondertekenen. Dan installeer je keer op keer de
eerste versie en lijkt elke fix mislukt. Dat is precies wat hier vijf rondes
lang gebeurde.

Pas in `bouw.js` de constanten `HH`, `FN` en `ANON` aan als het huishouden of
het project verandert.

## Installeren

iOS weigert niet-ondertekende opdrachtbestanden ronduit — "Onbetrouwbare
opdrachten toestaan" bestaat niet meer. Ondertekenen kan alleen op een Mac:

```
shortcuts sign -m anyone -i "weekmenu-deel-v7.shortcut" -o "weekmenu-deel-v7-ondertekend.shortcut"
```

Dubbelklik het resultaat, en deel het vanuit Opdrachten op de Mac als
iCloud-link. Die link openen op de iPhone installeert hem wél.

## De keten

1. **Haal URL's uit invoer** — vist de link uit wat het deelpaneel aanlevert
2. **Tekst** — `https://alfendirk-ctrl.github.io/weekmenu/?ig=<link>`
3. **Open URL's** — opent de app met die link

Meer niet. De opdracht haalt niets op en verstuurt niets; de app doet het werk.
Dat is bewust: alles wat in Opdrachten zelf gebeurt is alleen op een toestel te
testen, en daar zijn vier eerdere versies op stukgelopen. Wat in de app gebeurt
is wel te testen — zie `deel.js` in de scratchpad, dertien controles.

De app leest de parameter in `gedeeldeLink()`: knippen op het eerste `ig=` en de
rest ongewijzigd overnemen. De Instagram-link houdt namelijk zijn eigen
`?igsh=...`, dus opnieuw parsen als query zou hem afkappen. Gecodeerd
(`https%3A%2F%2F...`) mag ook.

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
