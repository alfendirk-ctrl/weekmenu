# Recept opslaan — iOS Shortcut

`weekmenu-deel-v10.shortcut` wordt gegenereerd door `bouw.js`:

```
node bouw.js "weekmenu-deel-v11.shortcut"
```

De generator schrijft de XML zelf. Dat is geen eigenwijsheid: de tussentijdse
variant met Python's `plistlib` leverde een bestand op dat Opdrachten op de Mac
niet meer wilde openen — tabs in plaats van spaties, en sleutels alfabetisch
gesorteerd in plaats van in de volgorde die Opdrachten aanhoudt. Wijk daar niet
van af; alles buiten het actieblok is byte voor byte gelijk aan een bestand dat
aantoonbaar geopend werd.

Drie dingen die `shortcuts sign` afketsen, alle drie met dezelfde nietszeggende
melding *"The file couldn't be opened because it isn't in the correct format"*:

- een **binair** plist (XML wel)
- de opmaak van `plistlib` (tabs, gesorteerde sleutels)
- een **onbekende actie-identifier** — het plist wordt als workflow ingelezen, en
  dan ketst het hele bestand af. Bewezen te werken: `detect.text`,
  `text.replace`, `downloadurl`, `showresult`, `getclipboard`. Afgeketst:
  `detect.link`, `openurl`.

Geef elke nieuwe versie een eigen bestandsnaam: bij een gelijke naam bewaart
macOS de download als `naam-1` en tekent `shortcuts sign` de oude.

## Installeren

iOS weigert niet-ondertekende opdrachtbestanden ronduit — "Onbetrouwbare
opdrachten toestaan" bestaat niet meer. Ondertekenen kan alleen op een Mac:

```
shortcuts sign -m anyone -i "weekmenu-deel-v10.shortcut" -o "v10-ondertekend.shortcut"
```

Dubbelklik het resultaat, en deel het vanuit Opdrachten op de Mac als
iCloud-link. Die link openen op de iPhone installeert hem wél.

## De keten

1. **Haal tekst op uit** — de gedeelde link als platte tekst
2. **Haal inhoud op van URL** — POST naar `ig-import` met `url` en `household_id`
3. **Toon resultaat**

De opdracht haalt zelf niets bij Instagram op; dat doet de Edge Function. Het
resultaat komt in `recipe_inbox` en de app pikt het op bij **Ophalen**.

De app kan ook een gedeelde link rechtstreeks verwerken, via
`?ig=<instagram-link>` — zie `gedeeldeLink()` in `index.html`. Dat pad is getest
(`deel.js`, dertien controles) en is de betere gebruikerservaring, maar het
vraagt de actie `openurl` in de opdracht en juist die komt niet door
`shortcuts sign`.

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
