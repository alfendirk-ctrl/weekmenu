// Genereert een .shortcut-bestand (plist) voor "Recept opslaan".
//
// De keten is bewust opgebouwd rond de Tekst-actie (is.workflow.actions.gettext).
// Die maakt van elke invoer een gewone tekenreeks. Zonder dat struikelt de
// URL-actie over opgemaakte tekst ("kon RTF-tekst niet omzetten in URL"): het
// deelblad van Instagram levert de link namelijk als attributed string aan, en
// zowel "Vervang tekst" als "Haal tekst op uit" houden die opmaak vast.
const fs = require("fs");

const HH   = "8d0e9587-7554-44f7-a7e4-4c308c16dafa";
const FN   = "https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko";

const U = {
  link : "B1000000-0001-4000-8000-000000000001",  // gedeelde link als platte tekst
  kaal : "B1000000-0002-4000-8000-000000000002",  // zonder ?igsh=...
  pagina:"B1000000-0003-4000-8000-000000000003",  // opgehaalde embed-pagina
  plat : "B1000000-0004-4000-8000-000000000004",  // die pagina als platte tekst
  post : "B1000000-0005-4000-8000-000000000005",  // antwoord van de server
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

// Tekstveld dat uit variabelen en losse tekst bestaat
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

// Tekst-actie: platst wat er binnenkomt tot een gewone tekenreeks
const platteTekst = (uuid, delen) => ({
  WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
  WFWorkflowActionParameters: { UUID: uuid, WFTextActionText: tekst(delen) },
});

const acties = [
  // 1. De gedeelde link, ontdaan van opmaak
  platteTekst(U.link, [invoer()]),

  // 2. Knip de tracking-parameters eraf: ?igsh=...
  { WFWorkflowActionIdentifier: "is.workflow.actions.text.replace",
    WFWorkflowActionParameters: {
      UUID: U.kaal,
      WFInput: losseVar(uit(U.link, "Tekst")),
      WFReplaceTextFind: tekst(["\\?.*$"]),
      WFReplaceTextReplace: tekst([""]),
      WFReplaceTextRegularExpression: true,
      WFReplaceTextCaseSensitive: false,
    } },

  // 3. Haal de embed-pagina op. Dit moet vanaf de telefoon: Instagram weigert
  //    datacenter-IP's en inmiddels ook de publieke proxy's.
  { WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
    WFWorkflowActionParameters: {
      UUID: U.pagina,
      WFHTTPMethod: "GET",
      WFURL: tekst([uit(U.kaal, "Bijgewerkte tekst"), "embed/captioned/"]),
    } },

  // 4. Ook die pagina platslaan, anders komt hij als bestand door en blijft het
  //    caption-veld leeg
  platteTekst(U.plat, [uit(U.pagina, "Inhoud van URL")]),

  // 5. Naar de server, die het bijschrift eruit pluist en Gemini het recept
  //    laat opmaken
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
        ["caption", [uit(U.plat, "Tekst")]],
        ["url", [uit(U.link, "Tekst")]],
        ["household_id", HH],
      ]),
    } },

  // 6. Laat zien wat de server terugzegt
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
  WFWorkflowInputContentItemClasses: [
    "WFURLContentItem", "WFStringContentItem", "WFSafariWebPageContentItem",
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
