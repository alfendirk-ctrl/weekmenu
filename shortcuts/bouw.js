// Genereert het .shortcut-bestand voor "Recept opslaan".
//
// Deze generator schrijft de XML zelf. Dat is geen eigenwijsheid: de variant met
// Python's plistlib gaf een bestand dat Opdrachten op de Mac niet meer wilde
// openen — tabs in plaats van spaties, en sleutels alfabetisch gesorteerd in
// plaats van in de volgorde die Opdrachten zelf aanhoudt. De uitvoer hieronder
// is wel geaccepteerd, dus daar wijken we niet meer van af.
//
// Verder geleerd, allemaal met dezelfde nietszeggende melding
// "The file couldn't be opened because it isn't in the correct format":
// - een binair plist wordt geweigerd, XML niet;
// - `shortcuts sign` leest het plist in als workflow, dus een actie-identifier
//   die het niet kent laat het hele bestand afketsen. Bewezen: detect.text,
//   text.replace, downloadurl, showresult, getclipboard.
//
// Geef elke nieuwe versie een eigen bestandsnaam: bij een gelijke naam bewaart
// macOS de download als "naam-1" en tekent `shortcuts sign` de oude.

const fs = require("fs");

const HH   = "8d0e9587-7554-44f7-a7e4-4c308c16dafa";
const FN   = "https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko";

const U = {
  link : "F1000000-0001-4000-8000-000000000001",  // de gedeelde link als tekst
  post : "F1000000-0002-4000-8000-000000000002",  // antwoord van de server
};
const OBJ = "￼";  // plaatshouder voor een variabele in een tekstveld

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// --- plist-bouwstenen ---
const p = (v, d=0) => {
  const t = "  ".repeat(d);
  if (v === true)  return t + "<true/>";
  if (v === false) return t + "<false/>";
  if (typeof v === "number") return t + "<integer>" + v + "</integer>";
  if (typeof v === "string") return t + "<string>" + esc(v) + "</string>";
  if (Array.isArray(v)) {
    if (!v.length) return t + "<array/>";
    return t + "<array>\n" + v.map(x => p(x, d+1)).join("\n") + "\n" + t + "</array>";
  }
  const k = Object.keys(v);
  if (!k.length) return t + "<dict/>";
  return t + "<dict>\n" + k.map(key =>
    "  ".repeat(d+1) + "<key>" + esc(key) + "</key>\n" + p(v[key], d+1)
  ).join("\n") + "\n" + t + "</dict>";
};

// Verwijzing naar de uitvoer van een eerdere actie
const uit = (uuid, naam) => ({ OutputUUID: uuid, OutputName: naam, Type: "ActionOutput" });
// Verwijzing naar wat er gedeeld is
const invoer = () => ({ Type: "ExtensionInput" });

// Tekstveld dat uit variabelen en losse tekst bestaat.
// delen = ["letterlijke tekst", {ref}, ...]
const tekst = (delen) => {
  let s = "", att = {};
  for (const d of delen) {
    if (typeof d === "string") { s += d; }
    else { att["{" + s.length + ", 1}"] = d; s += OBJ; }
  }
  const waarde = { string: s };
  if (Object.keys(att).length) waarde.attachmentsByRange = att;
  return { Value: waarde, WFSerializationType: "WFTextTokenString" };
};
const losseVar = (ref) => ({ Value: ref, WFSerializationType: "WFTextTokenAttachment" });

// Woordenboek voor koppen en JSON-velden
const woordenboek = (paren) => ({
  Value: { WFDictionaryFieldValueItems: paren.map(([k, v]) => ({
    WFItemType: 0, WFKey: tekst([k]), WFValue: typeof v === "string" ? tekst([v]) : tekst(v),
  })) },
  WFSerializationType: "WFDictionaryFieldValue",
});

const acties = [
  // 1. De gedeelde link als platte tekst
  { WFWorkflowActionIdentifier: "is.workflow.actions.detect.text",
    WFWorkflowActionParameters: {
      UUID: U.link,
      WFInput: losseVar(invoer()),
    } },

  // 2. Naar de server. Die haalt het bijschrift op en maakt er een recept van.
  { WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
    WFWorkflowActionParameters: {
      UUID: U.post,
      WFHTTPMethod: "POST",
      WFURL: tekst([FN]),
      WFHTTPHeaders: woordenboek([
        ["Authorization", "Bearer " + ANON],
        ["Content-Type", "application/json"],
      ]),
      WFHTTPBodyType: "JSON",
      WFJSONValues: woordenboek([
        ["url", [uit(U.link, "Tekst")]],
        ["household_id", HH],
      ]),
    } },

  // 3. Laat zien wat de server terugzegt
  { WFWorkflowActionIdentifier: "is.workflow.actions.showresult",
    WFWorkflowActionParameters: { Text: tekst([uit(U.post, "Inhoud van URL")]) } },
];

const wf = {
  WFQuickActionSurfaces: [],
  WFWorkflowActions: acties,
  WFWorkflowClientVersion: "3062.0.4.1",
  WFWorkflowHasOutputFallback: false,
  WFWorkflowHasShortcutInputVariables: true,
  WFWorkflowIcon: {
    WFWorkflowIconGlyphNumber: 59511,
    WFWorkflowIconStartColor: 4274264319,
  },
  WFWorkflowImportQuestions: [],
  WFWorkflowInputContentItemClasses: [
    "WFURLContentItem",
    "WFStringContentItem",
    "WFSafariWebPageContentItem",
  ],
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: "900",
  WFWorkflowOutputContentItemClasses: [],
  WFWorkflowTypes: ["ActionExtension"],
};

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
  + '<plist version="1.0">\n' + p(wf) + '\n</plist>\n';

fs.writeFileSync(process.argv[2], xml, "utf8");
console.log("geschreven:", process.argv[2], xml.length, "bytes");
