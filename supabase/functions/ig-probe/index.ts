// Edge Function: ig-probe — meetinstrument, geen productiecode.
//
// Legt een reeks routes naar hetzelfde Instagram-bijschrift naast elkaar en
// rapporteert per route: httpstatus, aantal bytes, en of er een bijschrift uit
// te halen viel. Zo kiezen we op basis van meting welke route in ig-import
// terechtkomt, in plaats van op basis van vermoedens.
//
//   POST /functions/v1/ig-probe   {"url":"https://www.instagram.com/reel/..."}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 1), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function decode(s: string): string {
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
function stripPrefix(s: string): string {
  const m = s.match(/likes?,[^:]*comments?\s*[-–—]\s*[^:]*?:\s*([\s\S]*)$/i);
  let t = (m && m[1] && m[1].trim().length > 10) ? m[1] : s;
  return t.trim().replace(/^[“”‘’'"]+/, "").replace(/[“”‘’'"]+$/, "").trim();
}
function extractCap(body: string): string | null {
  try {
    for (const [, raw] of body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      const d = JSON.parse(raw);
      const b = d.articleBody ?? (Array.isArray(d) ? d.find((x: any) => x.articleBody)?.articleBody : null);
      if (b && b.length > 5) return b;
    }
  } catch { /* door */ }
  try {
    const m = body.match(/window\.__additionalDataLoaded\(['"][^'"]*['"]\s*,\s*(\{[\s\S]+?\})\)/);
    const t = m && JSON.parse(m[1])?.graphql?.shortcode_media?.edge_media_to_caption?.edges?.[0]?.node?.text;
    if (t && t.length > 5) return t;
  } catch { /* door */ }
  const cm = body.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (cm) {
    const t = stripPrefix(decode(cm[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")));
    if (t.length > 20) return t;
  }
  const om = body.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (om) { const c = stripPrefix(decode(om[1])); if (c.length > 5) return c; }
  try {
    const d = JSON.parse(body);
    const c = d?.data?.description ?? d?.description ?? d?.contents;
    if (typeof c === "string" && c.length > 20) return stripPrefix(decode(c));
    if (typeof d?.contents === "string") { const x = extractCap(d.contents); if (x) return x; }
  } catch { /* geen json */ }
  if (!/<html|<meta|<script/i.test(body)) {
    let t = body;
    const mc = t.indexOf("Markdown Content:");
    if (mc >= 0) t = t.slice(mc + 17);
    t = t.replace(/^\s*(Title|URL Source|Published Time|Warning):.*$/gim, "")
      .replace(/!?\[[^\]]*\]\([^)]*\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (t.length > 40 && t.length < 20000) return stripPrefix(t);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const rawUrl = String(body.url ?? "").trim();
  const scm = rawUrl.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!scm) return json({ error: "geen shortcode in de url" }, 400);
  const sc = scm[2];

  const post = `https://www.instagram.com/p/${sc}/`;
  const embed = `https://www.instagram.com/p/${sc}/embed/captioned/`;
  const enc = encodeURIComponent(embed);
  const encPost = encodeURIComponent(post);

  // Twee soorten kandidaten: spiegels die Instagram namens jou ophalen
  // (bedoeld voor bots, dus ze mogen datacenter-IP's), en algemene proxy's.
  const routes: [string, string][] = [
    ["direct embed",        embed],
    ["kkinstagram",         `https://www.kkinstagram.com/p/${sc}/`],
    ["ddinstagram",         `https://www.ddinstagram.com/p/${sc}/`],
    ["d.ddinstagram",       `https://d.ddinstagram.com/p/${sc}/`],
    ["instafix",            `https://instafix.io/p/${sc}/`],
    ["microlink",           `https://api.microlink.io/?url=${encPost}&meta=true`],
    ["r.jina embed",        `https://r.jina.ai/${embed}`],
    ["allorigins raw",      `https://api.allorigins.win/raw?url=${enc}`],
    ["allorigins get",      `https://api.allorigins.win/get?url=${enc}`],
    ["codetabs",            `https://api.codetabs.com/v1/proxy?quest=${enc}`],
    ["corsproxy.io",        `https://corsproxy.io/?url=${enc}`],
    ["cors.lol",            `https://api.cors.lol/?url=${enc}`],
    ["whateverorigin",      `https://www.whateverorigin.org/get?url=${enc}`],
    ["thingproxy",          `https://thingproxy.freeboard.io/fetch/${embed}`],
  ];

  // Een sleutel in de omgeving? Dan meten we die betaalde routes mee.
  const sleutels: [string, string | undefined, (k: string) => string][] = [
    ["scraperapi",  Deno.env.get("SCRAPER_API_KEY"),  (k) => `https://api.scraperapi.com/?api_key=${k}&url=${enc}`],
    ["scrapingbee", Deno.env.get("SCRAPINGBEE_KEY"),  (k) => `https://app.scrapingbee.com/api/v1/?api_key=${k}&url=${enc}`],
    ["scrapingant", Deno.env.get("SCRAPINGANT_KEY"),  (k) => `https://api.scrapingant.com/v2/general?x-api-key=${k}&url=${enc}`],
  ];
  for (const [naam, k, maak] of sleutels) if (k) routes.push([naam, maak(k)]);

  const meet = async ([naam, u]: [string, string]) => {
    const t0 = Date.now();
    try {
      const r = await fetch(u, {
        headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/json" },
        signal: AbortSignal.timeout(20000),
        redirect: "follow",
      });
      const tekst = await r.text();
      const cap = extractCap(tekst);
      return {
        route: naam, status: r.status, bytes: tekst.length, ms: Date.now() - t0,
        bijschrift: cap ? cap.length : 0,
        begin: cap ? cap.slice(0, 120) : tekst.slice(0, 120).replace(/\s+/g, " "),
      };
    } catch (e) {
      return { route: naam, status: 0, bytes: 0, ms: Date.now() - t0, bijschrift: 0, begin: "FOUT: " + (e as Error).message };
    }
  };

  const uit = await Promise.all(routes.map(meet));
  uit.sort((a, b) => b.bijschrift - a.bijschrift);
  return json({ shortcode: sc, gemeten: uit.length, resultaten: uit });
});
