// Genereert een .shortcut-bestand (plist) voor "Recept opslaan".
const fs = require("fs");

const HH   = "8d0e9587-7554-44f7-a7e4-4c308c16dafa";
const FN   = "https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko";
const UA   = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const U = { plat :"A1B2C3D4-0005-4000-8000-000000000005",
            strip:"A1B2C3D4-0001-4000-8000-000000000001",
            haal :"A1B2C3D4-0002-4000-8000-000000000002",
            tekst:"A1B2C3D4-0003-4000-8000-000000000003",
            post :"A1B2C3D4-0004-4000-8000-000000000004" };
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
  // 1. Instagram deelt de link als opgemaakte tekst (RTF). Zonder deze stap
  //    klaagt de volgende actie dat hij er geen URL van kan maken.
  { WFWorkflowActionIdentifier: "is.workflow.actions.detect.text",
    WFWorkflowActionParameters: {
      UUID: U.plat,
      WFInput: losseVar(invoer()),
    } },

  // 2. Haal de tracking-parameters van de gedeelde link
  { WFWorkflowActionIdentifier: "is.workflow.actions.text.replace",
    WFWorkflowActionParameters: {
      UUID: U.strip,
      WFInput: losseVar(uit(U.plat, "Tekst")),
      WFReplaceTextFind: tekst(["\\?.*$"]),
      WFReplaceTextReplace: tekst([""]),
      WFReplaceTextRegularExpression: true,
      WFReplaceTextCaseSensitive: false,
    } },

  // 2. Haal de embed-pagina op; die bevat het volledige bijschrift
  { WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
    WFWorkflowActionParameters: {
      UUID: U.haal,
      WFHTTPMethod: "GET",
      WFURL: tekst([uit(U.strip, "Bijgewerkte tekst"), "embed/captioned/"]),
    } },

  // 3. Dwing de pagina naar platte tekst, anders komt hij als bestand door
  { WFWorkflowActionIdentifier: "is.workflow.actions.detect.text",
    WFWorkflowActionParameters: {
      UUID: U.tekst,
      WFInput: losseVar(uit(U.haal, "Inhoud van URL")),
    } },

  // 4. Stuur alles naar de server, die het recept eruit haalt
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
        ["caption", [uit(U.tekst, "Tekst")]],
        ["url", [uit(U.plat, "Tekst")]],
        ["household_id", HH],
      ]),
    } },

  // 5. Laat zien wat de server terugzegt
  { WFWorkflowActionIdentifier: "is.workflow.actions.showresult",
    WFWorkflowActionParameters: {
      Text: tekst([uit(U.post, "Inhoud van URL")]),
    } },
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
