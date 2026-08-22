// Genereert een .shortcut-bestand (plist) voor "Recept opslaan".
//
// De opdracht doet nog maar een ding: de app openen met de gedeelde link erin.
// Al het echte werk gebeurt daar, en dat is te testen. Elke eerdere versie liet
// Opdrachten zelf pagina's ophalen of JSON versturen, en juist daar liep het
// telkens vast op dingen die je alleen op een toestel ziet.
//
// Twee dingen blijven nodig:
// - Alleen WFURLContentItem als invoertype. Accepteert de opdracht ook tekst,
//   dan levert het deelpaneel een RTF-item en breekt alles af met "kon
//   RTF-tekst niet omzetten in URL".
// - detect.link plus een Tekst-actie, zodat er een gewone tekenreeks overblijft.
const fs = require("fs");

const APP = "https://alfendirk-ctrl.github.io/weekmenu/";

const U = {
  ruw  : "D1000000-0001-4000-8000-000000000001",  // link uit het deelpaneel
  adres: "D1000000-0002-4000-8000-000000000002",  // het app-adres met de link erin
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

  // 2. Plak hem achter het app-adres. De link houdt zijn eigen ?igsh=... ;
  //    de app knipt op het eerste "ig=" en neemt de rest ongewijzigd over.
  { WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
    WFWorkflowActionParameters: {
      UUID: U.adres,
      WFTextActionText: tekst([APP + "?ig=", uit(U.ruw, "URL's")]),
    } },

  // 3. Openen. De app haalt het bijschrift op en toont het recept.
  { WFWorkflowActionIdentifier: "is.workflow.actions.openurl",
    WFWorkflowActionParameters: { WFInput: losseVar(uit(U.adres, "Tekst")) } },
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
