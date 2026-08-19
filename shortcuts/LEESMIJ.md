# Recept opslaan — kant-en-klare iOS Shortcut

`Recept opslaan.shortcut` is een gegenereerd Shortcuts-bestand. Openen op de
iPhone, **Voeg opdracht toe** tikken, klaar. Daarna staat hij in het deelmenu
van Instagram.

Het bestand is niet door Apple ondertekend, dus zet eenmalig
**Instellingen → Apps → Opdrachten → Onbetrouwbare opdrachten toestaan** aan.
Die schakelaar verschijnt pas nadat je één keer een opdracht hebt uitgevoerd.

## Wat hij doet

1. **Vervang tekst** — knipt `?igsh=…` van de gedeelde link
2. **Haal inhoud op van URL** — GET op `<link>embed/captioned/` met een
   desktop-User-Agent. Dit moet vanaf de telefoon: Instagram weigert
   datacenter-IP's, en sinds augustus 2026 ook de publieke CORS-proxy's waar de
   app op leunde.
3. **Haal tekst uit invoer** — dwingt de pagina naar platte tekst. Zonder deze
   stap geeft Opdrachten de pagina door als bestand en komt er een leeg
   `caption`-veld aan.
4. **Haal inhoud op van URL** — POST naar `ig-import` met `caption` (de ruwe
   HTML), `url` en `household_id`. De Edge Function pluist de HTML uit en laat
   Gemini het recept eruit halen.
5. **Toon resultaat** — laat zien wat de server antwoordt.

## Opnieuw genereren

`node bouw.js "Recept opslaan.shortcut"`. Pas in `bouw.js` de constanten `HH`,
`FN` en `ANON` aan als het huishouden of het project verandert.
