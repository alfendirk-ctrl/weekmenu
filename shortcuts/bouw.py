#!/usr/bin/env python3
"""Genereert het .shortcut-bestand voor "Recept naar app".

Schrijft een *XML*-plist. Dat is wat `shortcuts sign` op de Mac accepteert;
een binair plist gaf daar "The file couldn't be opened because it isn't in the
correct format." Niet zelf omzetten naar binair dus.

De opdracht doet een ding: de app openen met de gedeelde link erin. Al het
echte werk gebeurt in de app en is daar getest (zie deel.js). Elke eerdere
versie liet Opdrachten zelf pagina's ophalen of JSON versturen, en juist dat
is alleen op een toestel te controleren.

Twee dingen blijven nodig:
- Alleen WFURLContentItem als invoertype. Accepteert de opdracht ook tekst, dan
  levert het deelpaneel een RTF-item en breekt alles af met "kon RTF-tekst niet
  omzetten in URL".
- detect.link plus een Tekst-actie, zodat er een gewone tekenreeks overblijft.

Geef elke nieuwe versie een eigen bestandsnaam: bij een gelijke naam bewaart
macOS de download als "naam-1" en blijft `shortcuts sign` de oude ondertekenen.
"""
import plistlib
import sys

APP = "https://alfendirk-ctrl.github.io/weekmenu/"
OBJ = "￼"  # plaatshouder voor een variabele in een tekstveld

U_LINK  = "D1000000-0001-4000-8000-000000000001"
U_ADRES = "D1000000-0002-4000-8000-000000000002"
U_OPEN  = "D1000000-0003-4000-8000-000000000003"


def uit(uuid, naam):
    return {"OutputUUID": uuid, "OutputName": naam, "Type": "ActionOutput"}


def losse_var(ref):
    return {"Value": ref, "WFSerializationType": "WFTextTokenAttachment"}


def tekst(delen):
    """Tekstveld dat uit letterlijke tekst en variabelen bestaat."""
    s, att = "", {}
    for d in delen:
        if isinstance(d, str):
            s += d
        else:
            att["{%d, 1}" % len(s)] = d
            s += OBJ
    waarde = {"string": s}
    if att:
        waarde["attachmentsByRange"] = att
    return {"Value": waarde, "WFSerializationType": "WFTextTokenString"}


ACTIES = [
    # 1. Vis de link uit wat het deelpaneel aanlevert
    {"WFWorkflowActionIdentifier": "is.workflow.actions.detect.link",
     "WFWorkflowActionParameters": {
         "UUID": U_LINK,
         "WFInput": losse_var({"Type": "ExtensionInput"}),
     }},

    # 2. Plak hem achter het app-adres. De link houdt zijn eigen ?igsh=... ;
    #    de app knipt op het eerste "ig=" en neemt de rest ongewijzigd over.
    {"WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
     "WFWorkflowActionParameters": {
         "UUID": U_ADRES,
         "WFTextActionText": tekst([APP + "?ig=", uit(U_LINK, "URL's")]),
     }},

    # 3. Openen. De app haalt het bijschrift op en toont het recept.
    {"WFWorkflowActionIdentifier": "is.workflow.actions.openurl",
     "WFWorkflowActionParameters": {
         "UUID": U_OPEN,
         "WFInput": losse_var(uit(U_ADRES, "Tekst")),
     }},
]

WORKFLOW = {
    "WFQuickActionSurfaces": [],
    "WFWorkflowActions": ACTIES,
    "WFWorkflowClientVersion": "3062.0.4.1",
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowIcon": {
        "WFWorkflowIconGlyphNumber": 59511,
        "WFWorkflowIconStartColor": 4274264319,
    },
    "WFWorkflowImportQuestions": [],
    # Alleen URL's: dan levert het deelpaneel een URL aan in plaats van RTF
    "WFWorkflowInputContentItemClasses": ["WFURLContentItem"],
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowTypes": ["ActionExtension"],
}

if __name__ == "__main__":
    pad = sys.argv[1]
    with open(pad, "wb") as f:
        plistlib.dump(WORKFLOW, f, fmt=plistlib.FMT_XML)
    print("geschreven:", pad)
