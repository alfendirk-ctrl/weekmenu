#!/usr/bin/env python3
"""Genereert het .shortcut-bestand voor "Recept opslaan".

Twee regels die hier duur zijn geleerd:

1. XML, niet binair. `shortcuts sign` weigert een binair plist met
   "The file couldn't be opened because it isn't in the correct format."

2. Alleen acties die aantoonbaar door de ondertekening komen. Versies met
   `is.workflow.actions.detect.link` en `is.workflow.actions.openurl` gaven
   diezelfde format-fout; met de vier hieronder lukte het ondertekenen wel.
   `shortcuts sign` leest het plist namelijk in als workflow, en een identifier
   die hij niet kent laat het hele bestand afketsen.

De opdracht stuurt de gedeelde link naar de Edge Function, die het bijschrift
ophaalt en Gemini er een recept van laat maken. Het resultaat komt in
recipe_inbox; de app pikt het op bij "Ophalen".

Geef elke nieuwe versie een eigen bestandsnaam: bij een gelijke naam bewaart
macOS de download als "naam-1" en blijft `shortcuts sign` de oude ondertekenen.
"""
import plistlib
import sys

HH   = "8d0e9587-7554-44f7-a7e4-4c308c16dafa"
FN   = "https://nejjocgplgbgmdornurw.supabase.co/functions/v1/ig-import"
ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5"
        "lampvY2dwbGdiZ21kb3JudXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTk4MzEsImV"
        "4cCI6MjA5OTE5NTgzMX0.dJ_xMqV4Qp-1gZKifYJ-qTW6p9GhoMdfxlr_zIJx7Ko")

OBJ = "￼"  # plaatshouder voor een variabele in een tekstveld

U_LINK = "E1000000-0001-4000-8000-000000000001"
U_POST = "E1000000-0002-4000-8000-000000000002"


def uit(uuid, naam):
    return {"OutputUUID": uuid, "OutputName": naam, "Type": "ActionOutput"}


def losse_var(ref):
    return {"Value": ref, "WFSerializationType": "WFTextTokenAttachment"}


def tekst(delen):
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


def woordenboek(paren):
    return {
        "Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0,
             "WFKey": tekst([k]),
             "WFValue": tekst([v]) if isinstance(v, str) else tekst(v)}
            for k, v in paren
        ]},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


ACTIES = [
    # 1. De gedeelde link als platte tekst
    {"WFWorkflowActionIdentifier": "is.workflow.actions.detect.text",
     "WFWorkflowActionParameters": {
         "UUID": U_LINK,
         "WFInput": losse_var({"Type": "ExtensionInput"}),
     }},

    # 2. Naar de server. Die haalt het bijschrift op en maakt er een recept van.
    {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
     "WFWorkflowActionParameters": {
         "UUID": U_POST,
         "WFHTTPMethod": "POST",
         "WFURL": tekst([FN]),
         "WFHTTPHeaders": woordenboek([
             ("Authorization", "Bearer " + ANON),
             ("Content-Type", "application/json"),
         ]),
         "WFHTTPBodyType": "JSON",
         "WFJSONValues": woordenboek([
             ("url", [uit(U_LINK, "Tekst")]),
             ("household_id", HH),
         ]),
     }},

    # 3. Laat zien wat de server terugzegt
    {"WFWorkflowActionIdentifier": "is.workflow.actions.showresult",
     "WFWorkflowActionParameters": {"Text": tekst([uit(U_POST, "Inhoud van URL")])}},
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
    "WFWorkflowInputContentItemClasses": [
        "WFURLContentItem", "WFStringContentItem", "WFSafariWebPageContentItem",
    ],
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
