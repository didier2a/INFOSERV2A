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
    assert.equal(matches(html, /href="(assets\/css\/claire-companion\.css\?v=20260901-aidant1)"/g).length, 1, page);
    assert.equal(matches(html, /src="(assets\/js\/claire-companion\.js\?v=20260901-aidant1)"/g).length, 1, page);
    assert.equal(matches(html, /"events":"(\.\/vendor\/liveavatar\/events-browser\.mjs)"/g).length, 1, page);
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
    "assets/js/claire-runtime-v2.mjs",
    "assets/js/claire-site-runtime-adapter.mjs",
    "assets/js/claire-liveavatar-provider.js",
    "vendor/liveavatar/events-browser.mjs",
    "data/site-knowledge.json",
    "data/claire-capabilities.json",
    "data/claire-aidant-figma.json",
    "docs/claire-aidant-plan.md",
    "claire-lab.html",
    "claire-aidant-figma.html",
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
  assert.match(client, /LiveAvatar configuré · transport interrompu/);
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
  assert.match(endpoint, /InfoServ2A Claire Aidant 1\.3/);
  assert.match(endpoint, /ne produis aucun texte, aucun son, aucun acquittement/);
  assert.match(endpoint, /opening_text:\s*CLAIRE_WELCOME/);
  assert.doesNotMatch(client, /this\.speak\(greeting\)/);
});

test("le direct exige les pistes LiveAvatar avant d’annoncer la connexion", async () => {
  const [provider, headers] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8"),
    readFile(path.join(ROOT, "_headers"), "utf8")
  ]);
  assert.match(provider, /SESSION_MEDIA_TIMEOUT_MS\s*=\s*45000/);
  assert.match(provider, /Promise\.race/);
  assert.match(provider, /await streamReady/);
  assert.match(provider, /await this\.waitForMediaTracks\(\)/);
  assert.match(provider, /TRACK_ATTACH_TIMEOUT_MS\s*=\s*18000/);
  assert.match(provider, /this\.streamReady = true/);
  assert.match(headers, /wss:\/\/\*\.livekit\.cloud/);
});

test("Chrome Android reçoit le son Realtime directement et peut le déverrouiller au toucher", async () => {
  const [client, provider] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(client, /provider\?\.primeAudio\?\.\(\)/);
  assert.match(provider, /this\.video\.muted = false/);
  assert.match(provider, /this\.video\.volume = 1/);
  assert.match(provider, /mediaTrackState\(this\.video\)/);
  assert.doesNotMatch(provider, /createMediaStreamSource/);
  assert.match(provider, /Touchez Claire pour activer le son/);
  assert.match(provider, /async resumeMedia\(\)/);
});

test("l’accueil Realtime est prononcé une seule fois par le contexte LiveAvatar", async () => {
  const [client, endpoint] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8")
  ]);
  assert.match(client, /this\.showWelcome\(greeting\)/);
  assert.match(client, /this\.showWelcome\(CLAIRE_WELCOME\)/);
  assert.doesNotMatch(client, /this\.speak\(greeting\)/);
  assert.doesNotMatch(client, /this\.speak\(CLAIRE_WELCOME\)/);
  assert.match(endpoint, /opening_text:\s*CLAIRE_WELCOME/);
});

test("le diagnostic mobile distingue micro, transcription et réponse Realtime", async () => {
  const [client, provider] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(client, /infoserv:claire-telemetry/);
  assert.match(client, /Diagnostic S22/);
  assert.match(provider, /input-detected/);
  assert.match(provider, /Transcription reçue/);
  assert.match(provider, /reply-started/);
  assert.match(provider, /Micro reçu, mais OpenAI Realtime ne renvoie pas de réponse/);
  assert.match(provider, /SESSION_STOPPED/);
});

test("les syllabes et doublons ne peuvent plus piloter la navigation", async () => {
  const [client, provider] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(provider, /TRANSCRIPT_SETTLE_MS\s*=\s*950/);
  assert.match(provider, /significant\.length < 4/);
  assert.match(provider, /buffering-transcript/);
  const speakingStart = provider.match(/AVATAR_SPEAK_STARTED[\s\S]*?AVATAR_TRANSCRIPTION/)?.[0] || "";
  const speakingEnd = provider.match(/AVATAR_SPEAK_ENDED[\s\S]*?SESSION_STOPPED/)?.[0] || "";
  assert.doesNotMatch(speakingStart + speakingEnd, /chat\.(?:mute|unmute)\(\)/);
  assert.match(provider, /conversation:user-transcription/);
  assert.match(client, /signature === this\.lastVoiceCommand/);
  assert.match(client, /this\.runtime\?\.activeCommandId/);
  assert.doesNotMatch(client, /navigationTimer|pendingNavigation/);
  assert.doesNotMatch(client, /article\.scrollIntoView/);
  assert.match(client, /scroller\.scrollTop = scroller\.scrollHeight/);
});

test("la navigation pilotée conserve Claire et ne recharge jamais le document", async () => {
  const [client, adapter, provider] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-site-runtime-adapter.mjs"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(client, /new ClaireRuntimeController/);
  assert.match(client, /InfoServ2ASiteAdapter/);
  assert.match(adapter, /querySelector\("#contenu"\)\?\.replaceWith\(nextMain\)/);
  assert.match(adapter, /persistentSession:\s*true/);
  assert.match(adapter, /history\.pushState/);
  assert.doesNotMatch(client + adapter, /location\.assign|location\.reload/);
  const speakingStart = provider.match(/AVATAR_SPEAK_STARTED[\s\S]*?AVATAR_TRANSCRIPTION/)?.[0] || "";
  assert.doesNotMatch(speakingStart, /stopListening/);
  assert.doesNotMatch(speakingStart, /voiceChat|\.mute\(|\.unmute\(/);
});

test("Realtime ne coupe plus la réponse sur la première syllabe", async () => {
  const provider = await readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8");
  const userTranscript = provider.match(/USER_TRANSCRIPTION[\s\S]*?AVATAR_SPEAK_STARTED/)?.[0] || "";
  const avatarStarted = provider.match(/AVATAR_SPEAK_STARTED[\s\S]*?AVATAR_TRANSCRIPTION/)?.[0] || "";
  const flushTranscript = provider.match(/async flushTranscript\(\)[\s\S]*?async connect/)?.[0] || "";
  assert.doesNotMatch(userTranscript, /session\.interrupt\(\)/);
  assert.doesNotMatch(avatarStarted, /clearTranscriptBuffer\(\)/);
  assert.doesNotMatch(flushTranscript, /if \(this\.avatarSpeaking/);
  assert.match(provider, /async pauseListening\(\)/);
  assert.match(provider, /session Claire conservée/);
});

test("le champ de pièces jointes masqué ne crée aucun débordement horizontal", async () => {
  const css = await readFile(path.join(ROOT, "assets/css/components.css"), "utf8");
  assert.match(css, /\.form input\.sr-only\s*\{[^}]*width:\s*1px[^}]*min-height:\s*1px[^}]*padding:\s*0[^}]*border:\s*0/s);
});

test("Claire se présente comme aidante Live Avatar", async () => {
  const [header, client, endpoint, knowledge] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8"),
    readFile(path.join(ROOT, "data/site-knowledge.json"), "utf8")
  ]);
  assert.match(header, /CLAIRE AIDANT LIVE/);
  assert.match(header, /aidante LiveAvatar/);
  assert.match(client, /aidante Live Avatar/);
  assert.match(endpoint, /aidante Live Avatar/);
  assert.match(knowledge, /Aidante Live Avatar/);
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
