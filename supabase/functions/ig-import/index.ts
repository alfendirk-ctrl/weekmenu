// Edge Function: ig-import
//
// Haalt een Instagram-bijschrift server-side op (geen CORS, echte User-Agent),
// laat Gemini het recept eruit halen en zet het resultaat in recipe_inbox.
// De app pikt het op bij de volgende sync.
//
// Aanroepen:
//   POST /functions/v1/ig-import
//   Authorization: Bearer <anon key>
//   {"url":"https://www.instagram.com/p/...","household_id":"...","caption":"..."}
//
// caption is optioneel maar wel de betrouwbare weg: Instagram blokkeert de
// datacenter-IP's waar Edge Functions op draaien, dus het bijschrift hier zelf
// ophalen lukt zelden. Stuurt de Shortcut het bijschrift mee (opgehaald vanaf de
// telefoon, of geplakt), dan slaan we die stap over. url mag dan weg, en dient
// alleen nog als bronvermelding.
//
// De Gemini-key komt uit de secret GEMINI_API_KEY. De app synct zijn eigen key
// bewust niet mee, dus zonder die secret werkt deze route niet.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ---------- bijschrift ophalen ----------

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

// og:description ziet eruit als: `1.234 likes, 56 comments - naam on May 1, 2024: "bijschrift"`
function stripPrefix(s: string): string {
  let t = s;
  const m = t.match(/likes?,[^:]*comments?\s*[-–—]\s*[^:]*?:\s*([\s\S]*)$/i);
  if (m && m[1] && m[1].trim().length > 10) t = m[1];
  return t.trim().replace(/^[“”‘’'"]+/, "").replace(/[“”‘’'"]+$/, "").trim();
}

function extractCap(body: string): string | null {
  // 1. JSON-LD articleBody
  try {
    const tags = [...body.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )];
    for (const [, raw] of tags) {
      const d = JSON.parse(raw);
      const b = d.articleBody ??
        (Array.isArray(d) ? d.find((x: any) => x.articleBody)?.articleBody : null);
      if (b && b.length > 5) return b;
    }
  } catch { /* volgende strategie */ }
  // 2. __additionalDataLoaded (embed-pagina)
  try {
    const m = body.match(/window\.__additionalDataLoaded\(['"][^'"]*['"]\s*,\s*(\{[\s\S]+?\})\)/);
    if (m) {
      const t = JSON.parse(m[1])?.graphql?.shortcode_media
        ?.edge_media_to_caption?.edges?.[0]?.node?.text;
      if (t && t.length > 5) return t;
    }
  } catch { /* volgende strategie */ }
  // 3. _sharedData (oudere pagina's)
  try {
    const m = body.match(/window\._sharedData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
    if (m) {
      const t = JSON.parse(m[1])?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media
        ?.edge_media_to_caption?.edges?.[0]?.node?.text;
      if (t && t.length > 5) return t;
    }
  } catch { /* volgende strategie */ }
  // 4. Caption in de embed-HTML
  const cm = body.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (cm) {
    const t = stripPrefix(decode(cm[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")));
    if (t.length > 20) return t;
  }
  // 5. og:description
  const om = body.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (om) {
    const c = stripPrefix(decode(om[1]));
    if (c.length > 5) return c;
  }
  return null;
}

async function fetchCaption(rawUrl: string): Promise<string | null> {
  if (!rawUrl) return null;
  const scm = rawUrl.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  const sc = scm ? scm[2] : null;
  const targets: string[] = [];
  if (sc) {
    targets.push(`https://www.instagram.com/p/${sc}/embed/captioned/`);
    targets.push(`https://www.instagram.com/p/${sc}/embed/`);
  }
  targets.push(rawUrl.split("?")[0]);

  for (const t of targets) {
    try {
      const r = await fetch(t, {
        headers: {
          "User-Agent": UA,
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) continue;
      const cap = extractCap(await r.text());
      if (cap && cap.length >= 20) return cap;
    } catch { /* volgende target */ }
  }
  return null;
}

// ---------- recept extraheren ----------

const RULES = `Geef UITSLUITEND geldige JSON terug, exact in dit formaat:
{"name":"","category":"","time":"","servings":2,"ingredients":[{"n":"","a":""}],"steps":[""]}

Regels:
- Alles in het Nederlands. Vertaal een anderstalig recept volledig.
- name: korte gerechtnaam, zonder emoji, hashtags of merknamen.
- category: exact een van deze vier: ontbijt, lunch, diner, tussendoortje.
- time: totale bereidingstijd, bijvoorbeeld "25 min". Staat die er niet? Schat realistisch.
- servings: geheel getal, aantal personen. Staat dat er niet? Gebruik 2.
- ingredients: splits elk ingredient apart. "n" is alleen de naam, enkelvoud en zonder hoeveelheid. "a" is de hoeveelheid met eenheid, bijvoorbeeld {"n":"bloem","a":"200 g"}. Geen hoeveelheid genoemd? Gebruik "a":"".
- steps: losse, volledige zinnen in de juiste volgorde. Laat stapnummers weg. Verzin geen stappen die er niet staan.
- Negeer hashtags, emoji, oproepen om te volgen/liken/taggen, links en reclame.
- Staat er geen recept in? Geef dan exact {"error":true}`;

const CATS = ["ontbijt", "lunch", "diner", "tussendoortje"];

// Welke modellen er bestaan verandert; een vaste lijst veroudert en levert dan
// "model is no longer available". Daarom vragen we het aan Google zelf en
// rangschikken we wat er terugkomt.
function rank(m: string): number {
  const v = parseFloat((m.match(/gemini-(\d+(?:\.\d+)?)/) ?? ["", "0"])[1]) || 0;
  const soort = /flash-lite/.test(m) ? 2 : /flash/.test(m) ? 3 : /pro/.test(m) ? 1 : 0;
  const risico = /preview|exp\b|experimental|thinking/.test(m) ? -2 : 0;
  return v * 10 + soort + risico;
}

async function pickModels(base: string, keyParam: string): Promise<string[]> {
  const terugval = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
  try {
    const r = await fetch(`${base}/models${keyParam}`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return terugval;
    const d = await r.json();
    const namen: string[] = (d?.models ?? [])
      .filter((m: any) => (m?.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: any) => String(m.name ?? "").replace(/^models\//, ""))
      // beeldgeneratie, spraak en embeddings kunnen dit niet en hebben vaak quota 0
      .filter((n: string) => n && !/image|imagen|tts|audio|embed|live|veo/i.test(n));
    if (!namen.length) return terugval;
    return namen.sort((a, b) => rank(b) - rank(a)).slice(0, 4);
  } catch {
    return terugval;
  }
}

async function extractRecipe(cap: string, apiKey: string) {
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const keyParam = "?key=" + encodeURIComponent(apiKey);
  const models = await pickModels(base, keyParam);
  const prompt =
    `Je krijgt het bijschrift van een Instagram-post. Haal daar het recept uit.\n\n${RULES}\n\nBijschrift:\n${cap}`;

  let lastErr = "";
  for (const model of models) {
    const call = (jsonMode: boolean) =>
      fetch(`${base}/models/${model}:generateContent${keyParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: jsonMode
            ? { temperature: 0, responseMimeType: "application/json" }
            : { temperature: 0 },
        }),
        signal: AbortSignal.timeout(45000),
      });

    let res = await call(true);
    if (res.status === 400) res = await call(false);
    if (!res.ok) {
      const tekst = await res.text().catch(() => "");
      // Quota 0 betekent: dit model mag deze key helemaal niet gebruiken.
      if (/limit:\s*0[,\s}"]/.test(tekst) || /"limit":\s*0[,}]/.test(tekst)) {
        lastErr = "quota van deze key staat op 0 voor " + model;
      } else if (res.status === 429) {
        lastErr = "Gemini-quota is op. Die reset elke dag.";
      } else {
        lastErr = `${model}: ${res.status}`;
      }
      continue;
    }

    const data = await res.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const fi = txt.indexOf("{"), li = txt.lastIndexOf("}");
    if (fi < 0 || li <= fi) { lastErr = "geen JSON in antwoord"; continue; }

    let p: any;
    try { p = JSON.parse(txt.slice(fi, li + 1)); } catch { lastErr = "ongeldige JSON"; continue; }
    if (p.error) throw new Error("Geen recept in dit bijschrift gevonden");

    return {
      name: String(p.name ?? "").trim() || "Naamloos recept",
      category: CATS.includes(p.category) ? p.category : "diner",
      time: String(p.time ?? "?").trim(),
      servings: Number(p.servings) > 0 ? Math.round(Number(p.servings)) : 2,
      ingredients: (Array.isArray(p.ingredients) ? p.ingredients : [])
        .map((g: any) => ({ n: String(g?.n ?? "").trim(), a: String(g?.a ?? "").trim() }))
        .filter((g: any) => g.n),
      steps: (Array.isArray(p.steps) ? p.steps : [])
        .map((s: any) => String(s).trim()).filter(Boolean),
    };
  }
  throw new Error(lastErr || "Gemini gaf geen bruikbaar antwoord");
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST vereist" }, 405);

  let body: { url?: string; household_id?: string; caption?: string };
  try { body = await req.json(); } catch { return json({ error: "Ongeldige JSON" }, 400); }

  const url = (body.url ?? "").trim();
  const meegestuurd = (body.caption ?? "").trim();
  const hid = (body.household_id ?? "").trim();
  if (!hid) return json({ error: "household_id ontbreekt" }, 400);
  if (!url && !meegestuurd) return json({ error: "url of caption ontbreekt" }, 400);
  if (url && !/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
    return json({ error: "Geen Instagram-link" }, 400);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Het huishouden moet bestaan — voorkomt dat willekeurige aanroepen quota opmaken.
  const { data: hh, error: hhErr } = await sb
    .from("weekmenu_sync").select("state").eq("household_id", hid).single();
  if (hhErr || !hh) return json({ error: "Onbekend huishouden" }, 403);

  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) {
    return json({
      error: "Geen Gemini API key op de server. Zet de secret GEMINI_API_KEY in Supabase.",
    }, 400);
  }

  // Instagram blokkeert de datacenter-IP's waar deze functie op draait, dus wat de
  // telefoon aanlevert gaat altijd voor. Dat mag ruwe HTML zijn — de Shortcut hoeft
  // dan zelf niets uit te pluizen, wij hebben het uitpakken hier toch al staan.
  const cap = meegestuurd.length > 20
    ? (/<\/?[a-z][\s\S]*>/i.test(meegestuurd)
        ? extractCap(meegestuurd)
        : stripPrefix(decode(meegestuurd)))
    : await fetchCaption(url);
  if (!cap) {
    // Ook naar de logs, want de melding op de telefoon wordt afgekapt.
    console.log("GEEN BIJSCHRIFT url=%s lengte=%d begin=%s",
      url, meegestuurd.length, JSON.stringify(meegestuurd.slice(0, 300)));
    // ontvangen/begin maken zichtbaar of de Shortcut wél iets aanleverde: een
    // lege caption en een onbruikbare pagina geven anders dezelfde melding.
    return json({
      error: "Bijschrift kon niet worden opgehaald. Instagram blokkeert deze post — laat de Shortcut het bijschrift meesturen, of importeer hem via een screenshot in de app.",
      ontvangen: meegestuurd.length,
      begin: meegestuurd.slice(0, 200),
    }, 422);
  }

  let recipe;
  try {
    recipe = await extractRecipe(cap, apiKey);
  } catch (e) {
    return json({ error: (e as Error).message }, 422);
  }

  const { error: insErr } = await sb.from("recipe_inbox")
    .insert({ household_id: hid, recipe, source_url: url || null });
  if (insErr) return json({ error: "Opslaan mislukt: " + insErr.message }, 500);

  return json({ ok: true, name: recipe.name, ingredients: recipe.ingredients.length });
});
