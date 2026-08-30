import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knowledge = JSON.parse(await readFile(path.join(ROOT, "data/site-knowledge.json"), "utf8"));
const pages = [...knowledge.pages.map((page) => page.href), "404.html"];

function matches(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

test("chaque page contient exactement une instance de Claire", async () => {
  for (const page of pages) {
    const html = await readFile(path.join(ROOT, page), "utf8");
    assert.equal(matches(html, /id="(claireCompanion)"/g).length, 1, page);
    assert.equal(matches(html, /href="(assets\/css\/claire-companion\.css\?v=20260830-live3)"/g).length, 1, page);
    assert.equal(matches(html, /src="(assets\/js\/claire-companion\.js\?v=20260830-live3)"/g).length, 1, page);
    assert.equal(matches(html, /class="(claire-avatar__video)"/g).length, 1, page);
    assert.equal(matches(html, /src="(assets\/images\/companion\/claire-liveavatar-1080x1920\.jpg)"/g).length, 2, page);
    assert.doesNotMatch(html, /claire-mini|claire-panel/);
  }
});

test("aucune page ne contient d’identifiant HTML dupliqué", async () => {
  for (const page of pages) {
    const html = await readFile(path.join(ROOT, page), "utf8");
    const ids = matches(html, /\sid="([^"]+)"/g);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual([...new Set(duplicates)], [], page);
  }
});

test("les pages et assets référencés par Claire existent", async () => {
  const required = [
    ...knowledge.pages.map((page) => page.href),
    "assets/css/claire-companion.css",
    "assets/images/companion/claire-liveavatar-1080x1920.jpg",
    "assets/js/claire-companion.js",
    "assets/js/claire-core.mjs",
    "assets/js/claire-liveavatar-provider.js",
    "data/site-knowledge.json",
    "functions/api/liveavatar-session.js",
    "functions/api/liveavatar-status.js"
  ];
  await Promise.all(required.map((relative) => access(path.join(ROOT, relative))));
});

test("Claire conserve une scène majeure et un mode guidé, jamais une bulle de support", async () => {
  const [html, css, client, provider] = await Promise.all([
    readFile(path.join(ROOT, "index.html"), "utf8"),
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(html, /data-claire-guided/);
  assert.match(html, /OpenAI Realtime · voix marin/);
  assert.match(css, /--claire-stage-width: clamp\(360px, 38vw, 540px\)/);
  assert.match(css, /body\.claire-is-guided/);
  assert.doesNotMatch(css, /bottom-right|claire-mini/);
  assert.match(client, /provider\.connect\(\{ microphone: true \}\)/);
  assert.match(client, /Mode local · Realtime non configuré/);
  assert.match(provider, /AgentEventsEnum\.AVATAR_TRANSCRIPTION/);
});

test("le client ne contient aucune clé de fournisseur", async () => {
  const client = await readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8");
  assert.doesNotMatch(client, /(?:OPENAI|LIVEAVATAR|HEYGEN)_API_KEY/);
  assert.doesNotMatch(client, /\bsk-[A-Za-z0-9_-]{20,}\b/);
});

test("le contrôle Realtime attend le Worker mobile et n'utilise jamais l'ancienne voix", async () => {
  const client = await readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8");
  assert.match(client, /LIVEAVATAR_STATUS_TIMEOUT_MS\s*=\s*12000/);
  assert.doesNotMatch(client, /setTimeout\(\(\) => controller\.abort\(\),\s*1600\)/);
  assert.doesNotMatch(client, /browserVoice\.speak\(greeting\)/);
  assert.match(client, /ancienne voix locale est volontairement désactivée/);
});

test("Claire accueille l'utilisateur et explique son rôle chez InfoServ2A", async () => {
  const [client, endpoint] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8")
  ]);
  for (const source of [client, endpoint]) {
    assert.match(source, /Bonjour et bienvenue chez InfoServ2A/);
    assert.match(source, /Je suis Claire, votre compagne numérique/);
    assert.match(source, /revenir à la navigation manuelle à tout moment/);
  }
  assert.match(endpoint, /InfoServ2A Claire Companion 1\.1/);
});

test("la sortie générée reste synchronisée avec le partial", async () => {
  const partial = await readFile(path.join(ROOT, "partials/header.html"), "utf8");
  const index = await readFile(path.join(ROOT, "index.html"), "utf8");
  const start = index.indexOf('<header class="site-header">');
  const end = index.indexOf("<!-- /chrome:header -->");
  assert.ok(start >= 0 && end > start);
  const generatedHeader = index.slice(start, end).trim();
  assert.equal(generatedHeader, partial.trim());
});
