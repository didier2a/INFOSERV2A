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
    assert.equal(matches(html, /href="(assets\/css\/claire-companion\.css\?v=20260911-claire-duplex-v1)"/g).length, 1, page);
    assert.equal(matches(html, /src="(assets\/js\/claire-companion\.js\?v=20260911-claire-duplex-v1)"/g).length, 1, page);
    assert.equal(matches(html, /"events":"(\.\/vendor\/liveavatar\/events-browser\.mjs)"/g).length, 1, page);
    assert.equal(matches(html, /class="(claire-avatar__video)"/g).length, 1, page);
    assert.equal(matches(html, /src="(assets\/images\/companion\/claire-liveavatar-1080x1920\.jpg)"/g).length, 2, page);
    assert.doesNotMatch(html, /claire-mini|claire-panel/);
  }
});

test("les modules Claire sont versionnés pour éviter un cache 24 h cassé", async () => {
  const files = [
    "assets/js/claire-companion.js",
    "assets/js/claire-liveavatar-provider.js",
    "assets/js/claire-runtime-v2.mjs",
    "assets/js/claire-site-runtime-adapter.mjs",
    "assets/js/site-email.mjs",
    "assets/js/claire-mobile-scene.mjs"
  ];
  for (const file of files) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    const bare = [...source.matchAll(/(?:from|import)\(?["'](\.\/[^"'?]+)["']/g)].map((match) => match[1]);
    assert.deepEqual(bare, [], `${file} importe sans ?v= : ${bare.join(", ")}`);
    if (source.includes("claire-core.mjs")) {
      assert.match(source, /claire-core\.mjs\?v=20260911-claire-actions-v1/);
    }
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
    "assets/js/claire-mobile-scene.mjs",
    "assets/js/claire-core.mjs",
    "assets/js/claire-session-memory.mjs",
    "assets/js/claire-runtime-v2.mjs",
    "assets/js/claire-site-runtime-adapter.mjs",
    "assets/js/claire-liveavatar-provider.js",
    "vendor/liveavatar/events-browser.mjs",
    "data/site-knowledge.json",
    "data/claire-capabilities.json",
    "data/claire-aidant-figma.json",
    "docs/claire-aidant-plan.md",
    "docs/activer-claire-sur-infoserv2a-pro.md",
    "docs/audit-externe-20260906-preview.md",
    "claire-lab.html",
    "claire-aidant-figma.html",
    "functions/api/liveavatar-session.js",
    "functions/api/liveavatar-status.js",
    "functions/api/liveavatar-origin.js"
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
  assert.match(html, /Claire en direct/);
  assert.doesNotMatch(html, /OpenAI Realtime · voix marin/);
  assert.match(css, /--claire-stage-width: 33\.333vw/);
  assert.match(css, /body\.claire-is-guided/);
  assert.doesNotMatch(css, /bottom-right|claire-mini/);
  const voiceStart = client.match(/async start\(\)[\s\S]*?\n  \}/)?.[0] || "";
  const textStart = client.match(/async ensureTextConversation\(\)[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(voiceStart, /connectLiveSession\(\{ microphone: true/);
  assert.match(textStart, /connectLiveSession\(\{ microphone: false/);
  assert.match(client, /provider\.connect\(\{ microphone: microphoneRequested \}\)/);
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
  assert.match(client, /LIVEAVATAR_CLOUD_FALLBACKS/);
  assert.match(client, /infoserv2a\.infoserv2a\.workers\.dev/);
  assert.match(client, /probeLiveAvatarStatus/);
  assert.match(client, /ensureProviderReady/);
  assert.match(client, /this\.state === "arrival"/);
  assert.doesNotMatch(client, /setTimeout\(\(\) => controller\.abort\(\),\s*1600\)/);
  assert.doesNotMatch(client, /browserVoice\.speak\(greeting\)/);
  assert.match(client, /ancienne voix locale est volontairement désactivée/);
});

test("Claire accueille l'utilisateur et explique son rôle chez InfoServ2A", async () => {
  const [client, endpoint, core] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-core.mjs"), "utf8")
  ]);
  assert.match(core, /Moi c’est Claire, collaboratrice numérique IT d’InfoServ2A/);
  assert.match(core, /navigation manuelle reste toujours disponible/);
  assert.match(core, /être interrompue à tout moment/);
  assert.match(core, /onglets du site/);
  assert.doesNotMatch(core, /Je reste uniquement dans l’informatique/);
  assert.match(client, /CLAIRE_WELCOME/);
  assert.match(endpoint, /CLAIRE_WELCOME/);
  assert.match(endpoint, /InfoServ2A Claire Actions V1 20260911/);
  assert.match(endpoint, /buildClaireContextPrompt/);
  assert.match(endpoint, /temperature:\s*0\.75/);
  assert.match(endpoint, /opening_text:\s*CLAIRE_WELCOME/);
  assert.match(core, /INFOSERV2A_PAGE_CONTEXT/);
  assert.match(core, /INFOSERV2A_SITE_BRIEFING/);
  assert.match(core, /INFOSERV2A_SESSION_MEMORY/);
  assert.match(core, /INFOSERV2A_OFF_TOPIC/);
  assert.match(core, /interlocutrice professionnelle/);
  assert.match(core, /collaboratrice numérique IT généraliste/);
  assert.doesNotMatch(client, /this\.speak\(greeting\)/);
  assert.doesNotMatch(core, /n’importe quel sujet/);
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
  assert.match(headers, /https:\/\/\*\.infoserv2a\.workers\.dev/);
  assert.match(headers, /https:\/\/unpkg\.com/);
  assert.match(headers, /https:\/\/\*\.liveavatar\.com/);
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

test("l’accueil Realtime est prononcé une seule fois, avec relance explicite si le contexte reste muet", async () => {
  const [client, endpoint, provider] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(client, /this\.showWelcome\(greeting\)/);
  assert.match(client, /const greeting = CLAIRE_WELCOME/);
  assert.doesNotMatch(client, /this\.speak\(greeting\)/);
  assert.doesNotMatch(client, /this\.speak\(CLAIRE_WELCOME\)/);
  assert.match(client, /scheduleSilentSiteSync/);
  assert.match(client, /provider\?\.sendWelcome\?\.\(text\)/);
  assert.match(provider, /sendWelcome\(value\)/);
  assert.match(provider, /INFOSERV2A_OPENING/);
  assert.match(provider, /isInternalSitePrompt/);
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
  assert.match(provider, /Je synchronise la page de droite/);
  assert.match(provider, /reply-started/);
  assert.match(provider, /Le site a répondu, mais Claire n’a pas encore pu le dire à voix haute/);
  assert.match(provider, /SESSION_STOPPED/);
});

test("les syllabes et doublons ne peuvent plus piloter la navigation", async () => {
  const [client, provider] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8")
  ]);
  assert.match(provider, /TRANSCRIPT_SETTLE_MS\s*=\s*450/);
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
  assert.doesNotMatch(adapter, /location\.assign|location\.reload/);
  assert.doesNotMatch(client, /location\.reload/);
  assert.match(client, /if \(!ok\) location\.assign\(url\.href\)/);
  const speakingStart = provider.match(/AVATAR_SPEAK_STARTED[\s\S]*?AVATAR_TRANSCRIPTION/)?.[0] || "";
  assert.doesNotMatch(speakingStart, /stopListening/);
  assert.doesNotMatch(speakingStart, /voiceChat|\.mute\(|\.unmute\(/);
});

test("Realtime ne coupe plus la réponse sur la première syllabe", async () => {
  const provider = await readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8");
  const userTranscript = provider.match(/USER_TRANSCRIPTION[\s\S]*?AVATAR_SPEAK_STARTED/)?.[0] || "";
  const avatarStarted = provider.match(/AVATAR_SPEAK_STARTED[\s\S]*?AVATAR_TRANSCRIPTION/)?.[0] || "";
  const flushTranscript = provider.match(/async flushTranscript\([\s\S]*?async connect/)?.[0] || "";
  assert.doesNotMatch(userTranscript, /if \(this\.avatarSpeaking\) this\.bargeIn\("user-barge-in"\)/);
  assert.match(provider, /bargeIn\("manual-interrupt"\)/);
  assert.match(provider, /bargeIn\("mic-tap"\)/);
  assert.match(flushTranscript, /sync-site/);
  assert.doesNotMatch(flushTranscript, /settled-site-command/);
  assert.doesNotMatch(avatarStarted, /clearTranscriptBuffer\(\)/);
  assert.match(provider, /async pauseListening\(\)/);
  assert.match(provider, /session Claire conservée/);
});

test("le champ de pièces jointes masqué ne crée aucun débordement horizontal", async () => {
  const css = await readFile(path.join(ROOT, "assets/css/components.css"), "utf8");
  assert.match(css, /\.form input\.sr-only(?:,\s*\.form \.sr-only input)?\s*\{[^}]*width:\s*1px[^}]*min-height:\s*1px[^}]*padding:\s*0[^}]*border:\s*0/s);
});

test("la parole de Claire s’écrit dans un encart visible, hors de son visage", async () => {
  const [html, css, client] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8")
  ]);
  const desktop = css.split("@media (max-width: 820px)")[0];
  assert.match(html, /data-claire-live-prompt/);
  assert.match(html, /data-claire-caption/);
  assert.match(html, /data-claire-caption-context/);
  assert.match(html, /data-claire-quest/);
  assert.match(client, /updateLiveCaption/);
  assert.match(client, /renderQuoteQuest/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-live-prompt \{[\s\S]*left: calc\(var\(--claire-stage-width\) \+ 0\.9rem\)/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-dialogue \{[\s\S]*display: grid/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-command input \{[\s\S]*min-height: 44px/);
});

test("la conversation guidée garde le champ d’écriture dans le rail", async () => {
  const css = await readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8");
  const desktop = css.split("@media (max-width: 820px)")[0];
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(desktop, /\[data-state="guided"\] \.claire-dialogue \{[\s\S]*display: grid/);
  assert.match(desktop, /\[data-transcript="open"\] \.claire-dialogue \{[\s\S]*position: fixed/);
  assert.match(desktop, /left: calc\(var\(--claire-stage-width\) \+ 0\.75rem\)/);
  assert.doesNotMatch(desktop, /max-height: min\(38vh, 340px\)/);
  assert.match(mobile, /\[data-state="guided"\] \.claire-dialogue \{[\s\S]*display: none/);
  assert.match(mobile, /\[data-composer="open"\] \.claire-dialogue \{[\s\S]*display: grid/);
  assert.match(mobile, /\[data-transcript="open"\] \.claire-dialogue \{[\s\S]*position: fixed/);
  assert.doesNotMatch(mobile, /max-height: min\(32vh, 210px\)/);
  assert.match(css, /--claire-mobile-stage: clamp\(176px/);
  assert.match(css, /--claire-mobile-lisere: 40px/);
  assert.match(css, /min-width: 821px/);
  assert.match(mobile, /scroll-padding-top/);
  assert.match(mobile, /scroll-margin-top/);
  assert.match(mobile, /--claire-vvh/);
});

test("Claire reste en deux colonnes sur ordinateur et s’empile seulement sous 820px", async () => {
  const [css, client, provider, html] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8"),
    readFile(path.join(ROOT, "index.html"), "utf8")
  ]);
  const desktop = css.split("@media (max-width: 820px)")[0];
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(desktop, /grid-template-columns: minmax\(340px, 46%\) minmax\(0, 1fr\)/);
  assert.match(desktop, /padding-left: var\(--claire-stage-width\)/);
  assert.doesNotMatch(desktop, /grid-template-columns: 1fr;/);
  assert.match(mobile, /grid-template-columns: 1fr;/);
  assert.match(client, /function isPhoneShell\(/);
  assert.match(client, /if \(isPhoneShell\(\)\) return;/);
  assert.match(client, /preflightMicrophone/);
  assert.match(provider, /webkit-playsinline/);
  assert.match(provider, /async unlockPlayback\(/);
  assert.match(css, /\.claire-manual-bar span \{[^}]*overflow: hidden/);
  assert.match(client, /claire-is-manual/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /webkit-playsinline/);
});

test("une transcription vocale coupe la réponse spontanée seulement si le site doit agir", async () => {
  const [client, provider, main, css, header] = await Promise.all([
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/main.js"), "utf8"),
    readFile(path.join(ROOT, "assets/css/components.css"), "utf8"),
    readFile(path.join(ROOT, "partials/header.html"), "utf8")
  ]);
  assert.match(provider, /bargeIn\("manual-interrupt"\)/);
  assert.doesNotMatch(provider, /if \(this\.avatarSpeaking\) this\.bargeIn\("user-barge-in"\)/);
  assert.doesNotMatch(provider, /cancelUnauthorizedReply\("user-speak-ended"\)/);
  assert.match(provider, /natural-reply/);
  assert.match(provider, /sendContext/);
  assert.match(client, /appendLiveCompanion/);
  assert.match(client, /data-site-truth|dataset.siteTruth/);
  assert.match(client, /restorePersistedConversation/);
  assert.match(client, /flushPendingLiveMemory/);
  assert.match(client, /pendingLiveMemory/);
  assert.match(client, /formatLiveMemoryCue/);
  assert.match(client, /Envoi en cours/);
  assert.match(client, /shouldExecuteSiteRuntime/);
  assert.match(client, /syncVisibleForms/);
  assert.match(client, /isUrgentSiteCommand/);
  assert.match(provider, /isUrgentSiteCommand/);
  assert.match(provider, /isStableUrgentCommand/);
  assert.match(provider, /resumeListen/);
  assert.match(provider, /stopListening/);
  assert.match(client, /classifyUtterance/);
  assert.match(client, /followSpokenNavigation/);
  assert.match(client, /syncSiteToSpeech/);
  assert.match(client, /provider\?\.userSpeaking/);
  assert.doesNotMatch(client, /listening && !this\.provider\.avatarSpeaking/);
  assert.match(client, /source === "liveavatar"/);
  assert.match(client, /\[data-claire-interrupt\]/);
  assert.match(client, /toggleGuidedTranscript/);
  assert.match(client, /handleSiteLink/);
  assert.match(client, /claimUserSiteNavigation/);
  assert.match(client, /createSpeechFollowGate/);
  assert.match(client, /speechFollowGate\.allowsFollow/);
  assert.match(client, /announce: false, silent: true/);
  assert.match(client, /isolateVoice/);
  assert.match(client, /sendBriefing/);
  assert.match(client, /sendSessionMemory/);
  assert.match(client, /beginNewQuoteAfterSend/);
  assert.match(client, /resetQuoteNeed/);
  assert.match(client, /closeQuoteAfterSuccessfulSend/);
  assert.match(client, /infoserv:email-sent/);
  assert.match(client, /infoserv:email-sending/);
  assert.match(client, /data-claire-send-wait/);
  assert.match(main, /playSendChime/);
  assert.match(css, /form-sending__bar/);
  assert.match(header, /data-claire-send-wait/);
  assert.match(provider, /sendBriefing/);
  assert.match(provider, /sendMemory/);
  assert.match(provider, /INFOSERV2A_SITE_BRIEFING/);
  assert.match(provider, /INFOSERV2A_SESSION_MEMORY/);
  assert.match(provider, /let kind = "chat"/);
});

test("l’arrivée montre l’enseigne InfoServ2A et deux portes", async () => {
  const [header, css, client] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8")
  ]);
  assert.match(header, /Claire vous ouvre la boutique/);
  assert.match(header, /Vous êtes bien chez InfoServ2A/);
  assert.match(header, /Activer le son · ~8s/);
  assert.match(header, /La voix et le micro démarrent seulement après votre choix/);
  assert.doesNotMatch(header, /Le micro reste coupé/);
  assert.match(header, /Voir le site d’abord/);
  assert.doesNotMatch(header, /Naviguer sans Claire/);
  assert.match(header, /data-claire-arrival-form/);
  assert.match(header, /id="claireArrivalCommand"/);
  assert.match(header, /placeholder="Écrire à Claire"/);
  assert.match(header, /infoserv2a-logo-light\.svg/);
  assert.match(header, /Collaboratrice numérique IT/);
  assert.match(css, /claire-door--claire/);
  assert.match(css, /\.claire-arrival-write \{/);
  assert.match(client, /skipLiveResumeCue/);
  assert.match(client, /skipWelcome/);
  assert.match(client, /ensureTextConversation/);
  assert.match(client, /Claire reste à portée/);
});

test("Claire se présente comme collaboratrice numérique IT", async () => {
  const [header, client, endpoint, knowledge] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8"),
    readFile(path.join(ROOT, "data/site-knowledge.json"), "utf8")
  ]);
  assert.match(header, /Claire en direct/);
  assert.match(header, /collaboratrice numérique IT/);
  assert.match(header, /infoserv2a\.claire\.mode/);
  assert.match(header, /requested === "1"/);
  assert.match(header, /InfoServClaireBoot/);
  assert.match(header, /Prête/);
  assert.match(header, /data-claire-interrupt/);
  assert.match(header, /Interrompre/);
  assert.match(header, /Ranger Claire/);
  assert.match(header, /data-claire-session-notice/);
  assert.match(header, /Continuer avec Claire/);
  assert.ok(header.lastIndexOf("InfoServClaireBoot") > header.indexOf("data-claire-engine-status"));
  assert.doesNotMatch(header, /Vérification LiveAvatar/);
  assert.doesNotMatch(header, /Connexion en attente/);
  assert.match(client, /CLAIRE_WELCOME/);
  assert.match(endpoint, /CLAIRE_WELCOME/);
  assert.match(knowledge, /Collaboratrice numérique IT généraliste/);
});

test("la parole de Claire enchaîne les pages sans coupure nette", async () => {
  const [css, client, adapter] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-site-runtime-adapter.mjs"), "utf8")
  ]);
  const liveTurn = client.match(/appendLiveCompanion\([\s\S]*?finalizeLiveCompanionTurn/)?.[0] || "";
  const speakEnd = client.match(/onAvatarSpeakEnd: \(\) => \{[\s\S]*?\},/)?.[0] || "";
  assert.match(css, /view-transition-name:\s*claire-page/);
  assert.match(css, /claire-content-loading/);
  assert.match(css, /\[data-state="arrival"\] \.claire-live-stage__controls/);
  assert.match(css, /animation: claire-rise/);
  assert.match(css, /animation: claire-presence/);
  assert.match(adapter, /prefetchPage/);
  assert.match(adapter, /htmlForPage/);
  assert.match(adapter, /scroll = true/);
  assert.match(client, /SPEECH_FOLLOW_MS\s*=\s*360/);
  assert.match(client, /prefetchSpeechTarget/);
  assert.match(client, /prefetchLikelyPages/);
  assert.match(client, /scroll: !isolateVoice/);
  assert.match(speakEnd, /finalizeLiveCompanionTurn/);
  assert.match(speakEnd, /flushPendingLiveMemory/);
  assert.doesNotMatch(speakEnd, /flushSilentSiteSync|sendContext|sendBriefing/);
  assert.doesNotMatch(liveTurn, /replaceChildren/);
  assert.doesNotMatch(client, /#contenu"\)\?\.scrollIntoView/);
});

test("E-TIME-01 : 45 s avant la fin LiveAvatar, relancer sans quitter la page", async () => {
  const [header, css, client, provider, endpoint] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-liveavatar-provider.js"), "utf8"),
    readFile(path.join(ROOT, "functions/api/liveavatar-session.js"), "utf8")
  ]);
  assert.match(endpoint, /max_session_duration:\s*duration/);
  assert.match(endpoint, /resolveLiveAvatarSessionRetrySeconds/);
  assert.match(client, /grantedLiveAvatarSessionMs/);
  assert.match(client, /LIVEAVATAR_SESSION_WARNING_LEAD_MS/);
  assert.match(client, /armLiveAvatarSessionWatch/);
  assert.match(client, /sessionStartedAt/);
  assert.match(client, /showSessionNotice\("warning"\)/);
  assert.match(client, /La présence live se termine dans moins d’une minute/);
  assert.match(header, /data-claire-session-notice/);
  assert.match(header, /Continuer avec Claire/);
  assert.match(header, /data-claire-session-continue/);
  assert.match(css, /\.claire-session-notice \{[\s\S]*pointer-events: auto/);
  assert.match(css, /\.claire-live-prompt \{[\s\S]*pointer-events: none/);
  assert.match(css, /\.claire-live-prompt__quest:not\(\[hidden\]\) \{[\s\S]*pointer-events: none/);
  const reconnect = client.match(/async performLiveAvatarReconnect\([\s\S]*?\n  \}/)?.[0] || "";
  assert.match(reconnect, /provider\.reconnect/);
  assert.match(reconnect, /skipLiveResumeCue = true/);
  assert.match(reconnect, /welcomeShown = true/);
  assert.match(reconnect, /navigateInternal\(href, \{ announce: false, silent: true, historyMode: "replace" \}/);
  assert.doesNotMatch(reconnect, /location\.reload|location\.assign|enterManualMode|this\.interrupt\(/);
  assert.doesNotMatch(reconnect, /scheduleWelcomeTranscript|showWelcome/);
  assert.match(client, /onSessionStopped/);
  assert.match(provider, /async reconnect\(/);
  assert.match(provider, /notifySessionStopped/);
  assert.match(provider, /onSessionStopped/);
  const stopped = provider.match(/SESSION_STOPPED[\s\S]*?return streamReady/)?.[0] || "";
  assert.match(stopped, /notifySessionStopped\("session-stopped"\)/);
  assert.doesNotMatch(stopped, /enterManualMode|location\.reload/);
});

test("E-MOB-01 : hamburger mobile au-dessus de Claire, Escape ne quitte pas le guidé", async () => {
  const [css, client, navigation] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/navigation.js"), "utf8")
  ]);
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(mobile, /body\.claire-is-guided \.site-header \{[\s\S]*position: fixed[\s\S]*top: var\(--claire-mobile-chrome\)[\s\S]*z-index: 145/);
  assert.match(mobile, /body\.claire-is-guided \.nav-overlay \{[\s\S]*z-index: 149/);
  assert.match(mobile, /body\.claire-is-guided \.nav-panel \{[\s\S]*z-index: 150/);
  const escapeHandler = client.match(/document\.addEventListener\("keydown", \(event\) => \{[\s\S]*?\n    \}\);/)?.[0] || "";
  assert.match(escapeHandler, /if \(document\.querySelector\("\.nav-panel\.is-open"\)\) return/);
  assert.match(escapeHandler, /\["arrival", "shared", "action"\]\.includes\(this\.state\)/);
  assert.doesNotMatch(escapeHandler, /guided/);
  assert.match(navigation, /panel\.addEventListener\("click"/);
  assert.ok(
    navigation.includes('if (event.target?.closest?.("a[href]")) close()'),
    "un clic Contact dans le panneau doit fermer le menu"
  );
  assert.match(navigation, /nav-just-closed/);
  assert.match(css, /body\.nav-just-closed/);
  assert.match(client, /function isTypingControl\(/);
  assert.match(client, /function isSiteContentTarget\(/);
  assert.match(client, /closeGuidedTranscript/);
  assert.match(client, /handleSiteFieldPointer/);
  assert.match(client, /handleSiteFieldFocus/);
  assert.match(client, /isTypingControl\(document\.activeElement\)/);
  assert.doesNotMatch(client.match(/handleSiteLink\(event\) \{[\s\S]*?\n  \}/)?.[0] || "", /openConversation/);
});

test("E-MOB-FORM-01 : le doigt sur le devis ne déplie pas Claire", async () => {
  const [css, client, header] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "partials/header.html"), "utf8")
  ]);
  assert.match(css, /--claire-mobile-stage: clamp\(176px, calc\(var\(--claire-vvh, 100dvh\) \* 0\.34\), 220px\)/);
  assert.match(css, /--claire-mobile-lisere: 40px/);
  assert.match(css, /--claire-composer-band: 3\.4rem/);
  assert.match(css, /--claire-mobile-chrome: var\(--claire-mobile-lisere\)/);
  assert.match(css, /body\.claire-keyboard-open\.claire-is-guided:not\(\.claire-mobile-scene\) \{[\s\S]*padding-top: var\(--claire-mobile-lisere\)/);
  assert.match(css, /body\.claire-phone-shell\.claire-is-guided:not\(\.claire-mobile-scene\)/);
  assert.match(client, /closeGuidedTranscript\(\)/);
  assert.match(client, /isSiteContentTarget\(node\) && isTypingControl\(node\)/);
  assert.match(header, /placeholder="Écrire à Claire"/);
  assert.match(css, /\[data-state="guided"\] \.claire-command input \{[\s\S]*min-height: 44px/);
});

test("IT43 : rythme Claire — PC 1/3+2/3 fixe, mobile scène nominale hors speaking", async () => {
  const [css, client, header] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "partials/header.html"), "utf8")
  ]);
  const desktop = css.split("@media (max-width: 820px)")[0];
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(css, /--claire-stage-width: 33\.333vw/);
  assert.match(css, /--claire-mobile-lisere: 40px/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-dialogue \{[\s\S]*position: fixed[\s\S]*left: calc\(var\(--claire-stage-width\) \+ 0\.75rem\)/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-live-prompt \{[\s\S]*left: calc\(var\(--claire-stage-width\) \+ 0\.9rem\)/);
  assert.doesNotMatch(desktop, /\[data-state="guided"\] \.claire-dialogue \{[\s\S]*left: 0\.5rem/);
  assert.doesNotMatch(desktop, /padding-bottom: 8\.5rem/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-live-stage__chip/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-engine-badge/);
  assert.match(mobile, /\[data-mobile-scene="on"\][\s\S]*inset: 0/);
  assert.match(mobile, /\[data-mobile-scene="on"\][\s\S]*height: var\(--claire-vvh/);
  assert.match(mobile, /\[data-state="guided"\] \{[\s\S]*height: var\(--claire-mobile-lisere\)/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-dialogue,[\s\S]*display: none/);
  assert.match(mobile, /\[data-state="arrival"\] \.claire-live-stage,[\s\S]*inset: 0/);
  assert.match(mobile, /\[data-state="arrival"\] \.claire-dialogue,[\s\S]*max-height: min\(38vh, 320px\)/);
  assert.doesNotMatch(mobile, /\[data-mobile-scene="on"\] \.claire-dialogue,[\s\S]*background: rgba\(251, 250, 246, 0\.92\)/);
  assert.match(mobile, /claire-speaking-hint/);
  assert.match(mobile, /claire-zap-site/);
  assert.match(header, /Elle vous parle/);
  assert.match(header, /data-claire-zap-site/);
  assert.match(header, /data-mobile-scene="off"/);
  assert.match(header, /Claire vous ouvre la boutique/);
  assert.match(header, /Activer le son · ~8s/);
  assert.match(header, /Voir le site d’abord/);
  assert.match(client, /function isSpeakingPresence\(/);
  assert.match(client, /applyMobileSceneEvent\("start"\)/);
  assert.match(client, /applyMobileSceneEvent\("zap"\)/);
  assert.match(client, /applyMobileSceneEvent\("type"\)/);
  assert.match(client, /dataset\.mobileScene/);
  assert.match(client, /claire-mobile-scene/);
  assert.match(client, /yieldToHumanType/);
  assert.match(client, /zapMobileScene/);
  const voiceStart = client.match(/async start\(\)[\s\S]*?\n  \}/)?.[0] || "";
  const textStart = client.match(/async ensureTextConversation\(\)[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(voiceStart, /connectLiveSession\(\{ microphone: true, state: "guided" \}/);
  assert.match(textStart, /connectLiveSession\(\{ microphone: false, state: "guided", skipWelcome: true \}/);
  assert.match(textStart, /openMobileComposer\(\)/);
  assert.match(client, /storageSet\(STORAGE_MODE, state\)/);
  assert.match(client, /matchMedia\?\.\("\(max-width: 820px\)"\)/);
  assert.match(client, /nodes\.input\?\.addEventListener\("input", \(\) => this\.yieldToHumanType\(\)\)/);
  assert.doesNotMatch(client, /syncSpeakingStage\(/);
  assert.doesNotMatch(client, /pointer: coarse/);
  assert.doesNotMatch(client, /void this\.openConversation\(\)/);
});

test("IT48 : portable — CONTEXTE n’est plus un pop-up sur le site", async () => {
  const [css, client] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8")
  ]);
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(mobile, /claire-quote-quest[\s\S]*\.claire-live-prompt:not\(\[hidden\]\) \{[\s\S]*display: none !important/);
  assert.doesNotMatch(mobile, /padding-top: calc\(var\(--claire-mobile-chrome\) \+ 4\.8rem\)/);
  assert.match(client, /if \(this\.state !== "guided" \|\| sceneOn \|\| phone\)/);
  assert.match(client, /!shouldShowQuoteQuest\(/);
  assert.match(client, /this\.actionMode !== CLAIRE_ACTION_MODES\.CONSEIL/);
});

test("IT46 : portable — HUD scène, barre magasin nommée, hold humain", async () => {
  const [css, client, header] = await Promise.all([
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "partials/header.html"), "utf8")
  ]);
  assert.match(header, /data-claire-scene-status/);
  assert.match(header, /data-claire-scene-write/);
  assert.match(header, /data-claire-reopen-scene/);
  assert.match(header, /data-claire-scene-caption/);
  assert.match(header, /La revoir/);
  assert.match(css, /--claire-mobile-lisere: 40px/);
  assert.match(css, /claire-shop-return/);
  assert.match(css, /claire-scene-hud/);
  assert.match(css, /claire-mobile-shop/);
  assert.match(css, /display: none !important/);
  assert.match(client, /sceneStatusLabel/);
  assert.match(client, /claire-mobile-shop/);
  assert.match(client, /data-claire-scene-write/);
  assert.match(client, /data-claire-reopen-scene/);
  assert.match(client, /if \(!isPhoneShell\(\) \|\| this\.state !== "guided"\) return;/);
});

test("IT45 : scène mobile 9:16 — visage libre, CONTEXTE / quest / shop hors cadre", async () => {
  const css = await readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8");
  const desktop = css.split("@media (max-width: 820px)")[0];
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(desktop, /\[data-state="guided"\] \.claire-live-prompt \{[\s\S]*left: calc\(var\(--claire-stage-width\) \+ 0\.9rem\)/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-live-prompt \{[\s\S]*max-width: calc\(100vw - var\(--claire-stage-width\) - 1\.8rem\)/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-session-notice \{[\s\S]*left: calc\(var\(--claire-stage-width\) \+ 0\.85rem\)/);
  assert.match(desktop, /\[data-state="guided"\] \.claire-session-notice \{[\s\S]*max-width: calc\(100vw - var\(--claire-stage-width\) - 1\.7rem\)/);
  assert.match(mobile, /claire-quote-quest\.claire-is-guided:not\(\.claire-mobile-scene\)[\s\S]*display: none !important/);
  assert.match(mobile, /\[data-state="guided"\]:not\(\[data-mobile-scene="on"\]\) \.claire-live-prompt:not\(\[hidden\]\)/);
  assert.doesNotMatch(mobile, /claire-quote-quest\.claire-is-guided:not\(\.claire-mobile-scene\)[\s\S]{0,500}display: grid/);
  assert.match(mobile, /claire-quote-quest\.claire-mobile-scene[\s\S]*\.claire-live-prompt[\s\S]*display: none/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-live-prompt:not\(\[hidden\]\)/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-live-prompt__quest/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-session-notice:not\(\[hidden\]\)/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-live-stage__chip/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-live-stage__caption/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-engine-badge/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-conversation/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-speaking-hint/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-zap-site/);
  assert.match(css, /body\.claire-phone-shell\.claire-mobile-scene \.claire-live-prompt:not\(\[hidden\]\)/);
});

test("IT44 : aucun pop-up / carte blanche sur le visage (arrivée mobile + scène 9:16)", async () => {
  const css = await readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8");
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(mobile, /\[data-state="arrival"\] \.claire-live-stage,[\s\S]*inset: 0/);
  assert.match(mobile, /\[data-state="arrival"\] \.claire-dialogue,[\s\S]*max-height: min\(38vh, 320px\)/);
  assert.match(mobile, /\[data-state="arrival"\] \.claire-live-stage__chip,[\s\S]*display: none/);
  assert.match(mobile, /\[data-state="arrival"\] \.claire-live-stage__caption,[\s\S]*display: none/);
  assert.match(mobile, /\[data-mobile-scene="on"\] \.claire-dialogue,[\s\S]*display: none/);
  assert.match(mobile, /\[data-mobile-scene="on"\]\[data-transcript="open"\] \.claire-dialogue/);
  assert.doesNotMatch(mobile, /\[data-mobile-scene="on"\] \.claire-dialogue[\s\S]{0,200}background: rgba\(251, 250, 246/);
});

test("E-MOB-FACE-01 : les champs n’écrasent pas le visage de Claire", async () => {
  const css = await readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8");
  const mobile = css.split("@media (max-width: 820px)")[1].split("@media")[0];
  assert.match(mobile, /height: var\(--claire-mobile-lisere\)/);
  assert.match(mobile, /\[data-state="guided"\] \.claire-dialogue \{[\s\S]*position: fixed/);
  assert.match(mobile, /\[data-state="guided"\] \.claire-live-prompt:not\(\[hidden\]\)[\s\S]*display: none !important/);
  assert.match(mobile, /\[data-state="guided"\] \.claire-live-stage__caption/);
  assert.match(mobile, /padding-top: var\(--claire-mobile-chrome\)/);
});

test("la sortie générée reste synchronisée avec le partial", async () => {
  const partial = await readFile(path.join(ROOT, "partials/header.html"), "utf8");
  const index = await readFile(path.join(ROOT, "index.html"), "utf8");
  const start = index.indexOf('<header class="site-header med-header">');
  const end = index.indexOf("<!-- /chrome:header -->");
  assert.ok(start >= 0 && end > start);
  const generatedHeader = index.slice(start, end).trim();
  assert.equal(generatedHeader.replace(/ aria-current="page"/g, "").replace(/\r\n/g, "\n"), partial.trim().replace(/\r\n/g, "\n"));
});

test("audit externe corroboré : écrit dès l’arrivée, formulaires, rail, badge public", async () => {
  const [header, css, client, devis, contact, headers] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8"),
    readFile(path.join(ROOT, "assets/js/claire-companion.js"), "utf8"),
    readFile(path.join(ROOT, "devis.html"), "utf8"),
    readFile(path.join(ROOT, "contact.html"), "utf8"),
    readFile(path.join(ROOT, "_headers"), "utf8")
  ]);
  assert.match(header, /data-claire-arrival-form/);
  assert.match(header, /id="claireArrivalCommand"/);
  assert.match(client, /ensureTextConversation/);
  assert.match(client, /skipWelcome/);
  assert.match(client, /const micActive = Boolean\(this\.provider\?\.listening\)/);
  assert.match(client, /Écrivez-moi/);
  assert.match(devis, /placeholder="Ex\. Caméra 4G pour un hangar isolé, enregistrement 15 jours\."/);
  assert.match(devis, /Nom \/ prénom <span class="req"/);
  assert.match(devis, /Elles ne partent pas avec le premier mail/);
  assert.match(devis, /method="post"/);
  assert.match(devis, /Envoyer la demande à/);
  assert.match(devis, /Les champs marqués \* sont obligatoires/);
  assert.match(devis, /aria-describedby="devis-name-error"/);
  assert.match(contact, /<textarea[^>]+id="contact-message"[^>]+required/);
  assert.match(contact, /<label for="contact-name">Nom \*<\/label>/);
  assert.match(contact, /method="post"/);
  assert.match(contact, /Envoyer ma demande/);
  assert.match(contact, /\* Champs obligatoires/);
  assert.match(contact, /aria-describedby="contact-name-error"/);
  assert.match(client, /claire-quote-quest/);
  assert.match(client, /this\.avatarSpoken = ""/);
  const main = await readFile(path.join(ROOT, "assets/js/main.js"), "utf8");
  assert.match(main, /bindLiveValidation/);
  assert.match(main, /Veuillez renseigner /);
  assert.match(css, /body\.claire-is-manual \{[\s\S]*padding-bottom: calc\(6\.5rem/);
  assert.match(css, /body\.claire-quote-quest/);
  assert.match(headers, /static\.cloudflareinsights\.com/);
});

test("E-MAIL-01 : contact et devis partent vers l’e-mail du client, avec attente visible", async () => {
  const [contact, devis, workerSource, main] = await Promise.all([
    readFile(path.join(ROOT, "contact.html"), "utf8"),
    readFile(path.join(ROOT, "devis.html"), "utf8"),
    readFile(path.join(ROOT, "functions/api/send-email.js"), "utf8"),
    readFile(path.join(ROOT, "assets/js/main.js"), "utf8")
  ]);
  assert.match(contact, /Le récapitulatif est envoyé à votre adresse e-mail/);
  assert.match(devis, /l’e-mail que vous avez indiqué/);
  assert.match(main, /form-sending/);
  assert.match(devis, /form-sending/);
  assert.doesNotMatch(contact, /Le message part réellement vers contact@/);
  assert.doesNotMatch(devis, /La demande part réellement vers contact@/);
  assert.match(workerSource, /destinationInbox/);
  assert.match(workerSource, /BUSINESS_REPLY_TO/);
  assert.match(main, /playSendChime/);
  assert.match(main, /setEmailSending/);
});
