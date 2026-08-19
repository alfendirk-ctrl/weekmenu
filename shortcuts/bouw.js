// Genereert een .shortcut-bestand (plist) voor "Recept opslaan".
//
// De opdracht stuurt alleen de gedeelde link door; de Edge Function haalt het
// bijschrift zelf op en laat Gemini het recept eruit halen. Eerdere versies
// lieten de telefoon de pagina ophalen, omdat ik dacht dat Instagram servers
// weerde. Dat bleek niet zo: het lag aan het User-Agent-kenmerk. Nu de server
// het zelf kan, valt al dat gedoe op de telefoon weg.
//
// Twee dingen blijven nodig:
// - Alleen WFURLContentItem als invoertype. Accepteert de opdracht ook tekst,
//   dan levert het deelpaneel een RTF-item en breekt alles af met "kon
//   RTF-tekst niet omzetten in URL".
// - detect.link plus een Tekst-actie, zodat er een gewone tekenreeks in het
//   JSON-veld belandt.
const fs = require("fs");

const HH   = "8d0e9587-7554-44f7-a7e4-4c308c16dafa";
const FN   = "https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko";

const U = {
  ruw  : "C1000000-0001-4000-8000-000000000001",  // link uit het deelpaneel
  link : "C1000000-0002-4000-8000-000000000002",  // die link als platte tekst
  post : "C1000000-0003-4000-8000-000000000003",  // antwoord van de server
};
const OBJ = "￼";  // plaatshouder voor een variabele in een tekstveld

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const p = (v, d = 0) => {
  const t = "  ".repeat(d);
  if (v === true)  return t + "<true/>";
  if (v === false) return t + "<false/>";
  if (typeof v === "number") return t + "<integer>" + v + "</integer>";
  if (typeof v === "string") return t + "<string>" + esc(v) + "</string>";
  if (Array.isArray(v)) {
    if (!v.length) return t + "<array/>";
    return t + "<array>\n" + v.map(x => p(x, d + 1)).join("\n") + "\n" + t + "</array>";
  }
  const k = Object.keys(v);
  if (!k.length) return t + "<dict/>";
  return t + "<dict>\n" + k.map(key =>
    "  ".repeat(d + 1) + "<key>" + esc(key) + "</key>\n" + p(v[key], d + 1)
  ).join("\n") + "\n" + t + "</dict>";
};

const uit = (uuid, naam) => ({ OutputUUID: uuid, OutputName: naam, Type: "ActionOutput" });
const invoer = () => ({ Type: "ExtensionInput" });

const tekst = (delen) => {
  let s = "", att = {};
  for (const d of delen) {
    if (typeof d === "string") s += d;
    else { att["{" + s.length + ", 1}"] = d; s += OBJ; }
  }
  const waarde = { string: s };
  if (Object.keys(att).length) waarde.attachmentsByRange = att;
  return { Value: waarde, WFSerializationType: "WFTextTokenString" };
};
const losseVar = (ref) => ({ Value: ref, WFSerializationType: "WFTextTokenAttachment" });

const woordenboek = (paren) => ({
  Value: { WFDictionaryFieldValueItems: paren.map(([k, v]) => ({
    WFItemType: 0, WFKey: tekst([k]), WFValue: typeof v === "string" ? tekst([v]) : tekst(v),
  })) },
  WFSerializationType: "WFDictionaryFieldValue",
});

const acties = [
  // 1. Vis de link uit wat het deelpaneel aanlevert
  { WFWorkflowActionIdentifier: "is.workflow.actions.detect.link",
    WFWorkflowActionParameters: { UUID: U.ruw, WFInput: losseVar(invoer()) } },

  // 2. Als gewone tekenreeks, zodat hij schoon in het JSON-veld past
  { WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
    WFWorkflowActionParameters: { UUID: U.link, WFTextActionText: tekst([uit(U.ruw, "URL's")]) } },

  // 3. Versturen. De server doet de rest.
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

  // 4. Laat zien wat de server terugzegt
  { WFWorkflowActionIdentifier: "is.workflow.actions.showresult",
    WFWorkflowActionParameters: { Text: tekst([uit(U.post, "Inhoud van URL")]) } },
];

const wf = {
  WFQuickActionSurfaces: [],
  WFWorkflowActions: acties,
  WFWorkflowClientVersion: "3062.0.4.1",
  WFWorkflowHasOutputFallback: false,
  WFWorkflowHasShortcutInputVariables: true,
  WFWorkflowIcon: { WFWorkflowIconGlyphNumber: 59511, WFWorkflowIconStartColor: 4274264319 },
  WFWorkflowImportQuestions: [],
  // Alleen URL's: dan levert het deelpaneel een URL aan in plaats van RTF
  WFWorkflowInputContentItemClasses: ["WFURLContentItem"],
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
