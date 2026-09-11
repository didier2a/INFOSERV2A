import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://www.infoserv2a.pro";
const LASTMOD = "2026-09-11";

const HTML_CANONICALS = {
  "index.html": `${ORIGIN}/`,
  "404.html": `${ORIGIN}/`,
  "videosurveillance.html": `${ORIGIN}/videosurveillance`,
  "creation-site-web.html": `${ORIGIN}/creation-site-web`,
  "maintenance-distance.html": `${ORIGIN}/maintenance-distance`,
  "configuration-domicile.html": `${ORIGIN}/configuration-domicile`,
  "cybersecurite-ia.html": `${ORIGIN}/cybersecurite-ia`,
  "recuperation-donnees.html": `${ORIGIN}/recuperation-donnees`,
  "realisations.html": `${ORIGIN}/realisations`,
  "a-propos.html": `${ORIGIN}/a-propos`,
  "contact.html": `${ORIGIN}/contact`,
  "devis.html": `${ORIGIN}/devis`,
  "mentions-legales.html": `${ORIGIN}/mentions-legales`,
  "politique-confidentialite.html": `${ORIGIN}/politique-confidentialite`,
  "reseaux-wifi.html": `${ORIGIN}/reseaux-wifi`,
  "claire.html": `${ORIGIN}/claire`
};

const SITEMAP_URLS = Object.entries(HTML_CANONICALS)
  .filter(([file]) => !["404.html", "claire.html"].includes(file))
  .map(([, url]) => url);

test("les métadonnées SEO utilisent uniquement le www sans extension HTML", async () => {
  for (const [file, expected] of Object.entries(HTML_CANONICALS)) {
    const html = await readFile(path.join(ROOT, file), "utf8");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    const openGraphUrl = html.match(/<meta property="og:url" content="([^"]+)">/)?.[1];

    assert.equal(canonical, expected, `${file}: canonical`);
    assert.equal(openGraphUrl, expected, `${file}: og:url`);
    assert.doesNotMatch(html, /https:\/\/infoserv2a\.pro(?:\/|")/, `${file}: hôte apex`);
    assert.doesNotMatch(
      html,
      /https:\/\/www\.infoserv2a\.pro\/[^"'<\s]+\.html(?:[#?][^"'<\s]*)?/,
      `${file}: URL absolue .html`
    );
  }
});

test("Claire reste accessible mais ne demande pas son indexation", async () => {
  const html = await readFile(path.join(ROOT, "claire.html"), "utf8");
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
});

test("le sitemap ne contient que les pages publiques canoniques mises à jour", async () => {
  const xml = await readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  const urls = [...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)];

  assert.deepEqual(urls.map((match) => match[1]), SITEMAP_URLS);
  assert.deepEqual([...new Set(urls.map((match) => match[2]))], [LASTMOD]);
  assert.doesNotMatch(xml, /\.html|\/claire(?:<|\/)|https:\/\/infoserv2a\.pro/);
});

test("robots.txt annonce le sitemap canonique et conserve les exclusions Claire", async () => {
  const robots = await readFile(path.join(ROOT, "robots.txt"), "utf8");

  assert.match(robots, /^Sitemap: https:\/\/www\.infoserv2a\.pro\/sitemap\.xml$/m);
  for (const path of [
    "/claire-lab.html",
    "/claire-lab",
    "/claire-aidant-figma.html",
    "/claire-aidant-figma"
  ]) {
    assert.match(robots, new RegExp(`^Disallow: ${path.replace(".", "\\.")}$`, "m"));
  }
});
