import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLAIRE_DISCOVERY_DISMISSED_KEY,
  CLAIRE_DISCOVERY_SEEN_KEY,
  MOBILE_PIP_DRAG_THRESHOLD_PX,
  MOBILE_PIP_EDGE_MAGNET_PX,
  MOBILE_PIP_STORAGE_KEY,
  MOBILE_SURFACES,
  PHONE_MEDIA_QUERY,
  clampMobilePipPoint,
  createMobileUxState,
  dismissClaireDiscovery,
  isMobileFormPath,
  magnetizeMobilePipPoint,
  markClaireDiscoverySeen,
  mobilePipDragExceeded,
  mobilePipPercentFromPoint,
  mobilePipPointFromPercent,
  mobileTabForLocation,
  mobileUxLocksScroll,
  reduceMobileUx,
  shouldShowClaireDiscovery
} from "../assets/js/claire-mobile-ux.mjs";

test("smartphone shell starts on the classic site without PiP", () => {
  const state = createMobileUxState({ pathname: "/", hash: "" });
  assert.equal(PHONE_MEDIA_QUERY, "(max-width: 768px)");
  assert.equal(state.surface, MOBILE_SURFACES.SITE);
  assert.equal(state.activeTab, "accueil");
  assert.equal(mobileUxLocksScroll(state), false);
});

test("devis and contact keep the full form alone, with or without .html", () => {
  for (const pathname of ["/devis", "/devis.html", "/contact", "/contact.html"]) {
    const state = reduceMobileUx(createMobileUxState(), { type: "route", pathname });
    assert.equal(state.surface, MOBILE_SURFACES.SITE);
    assert.equal(state.activeTab, "devis");
    assert.equal(state.sheetExpanded, false);
    assert.equal(isMobileFormPath(pathname), true);
  }
});

test("Claire tab is full, then an explicit exit can offer the PiP medallion", () => {
  let state = createMobileUxState({ pathname: "/videosurveillance.html" });
  state = reduceMobileUx(state, { type: "open-claire" });
  assert.equal(state.surface, MOBILE_SURFACES.CLAIRE);
  assert.equal(state.activeTab, "claire");
  state = reduceMobileUx(state, {
    type: "show-pip",
    pathname: "/videosurveillance.html"
  });
  assert.equal(state.surface, MOBILE_SURFACES.PIP);
  assert.equal(state.activeTab, "services");
});

test("opt-in PiP survives site navigation until explicit evacuation", () => {
  let state = createMobileUxState({ pathname: "/" });
  state = reduceMobileUx(state, { type: "show-pip", pathname: "/" });
  state = reduceMobileUx(state, { type: "route", pathname: "/reseaux-wifi.html" });
  assert.equal(state.surface, MOBILE_SURFACES.PIP);
  assert.equal(state.activeTab, "services");
  state = reduceMobileUx(state, { type: "evacuate-pip", pathname: "/reseaux-wifi.html" });
  assert.equal(state.surface, MOBILE_SURFACES.SITE);
});

test("guided mode is exclusive and dismisses to the correct site surface", () => {
  let state = createMobileUxState({ pathname: "/reseaux-wifi.html" });
  state = reduceMobileUx(state, {
    type: "guide",
    pathname: "/reseaux-wifi.html"
  });
  assert.equal(state.surface, MOBILE_SURFACES.GUIDED);
  assert.equal(mobileUxLocksScroll(state), true);
  state = reduceMobileUx(state, {
    type: "dismiss-guide",
    pathname: "/reseaux-wifi.html"
  });
  assert.equal(state.surface, MOBILE_SURFACES.SITE);
  assert.equal(mobileUxLocksScroll(state), false);
});

test("legacy sheet events cannot make forms open a sheet by default", () => {
  let state = createMobileUxState({ pathname: "/devis.html" });
  assert.equal(state.surface, MOBILE_SURFACES.SITE);
  state = reduceMobileUx(state, { type: "expand-sheet" });
  assert.equal(mobileUxLocksScroll(state), false);
});

test("Découvrir Claire is once per session and X persists forever", () => {
  const memoryStorage = () => {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    };
  };
  const session = memoryStorage();
  const local = memoryStorage();
  assert.equal(shouldShowClaireDiscovery(session, local), true);
  markClaireDiscoverySeen(session);
  assert.equal(session.getItem(CLAIRE_DISCOVERY_SEEN_KEY), "1");
  assert.equal(shouldShowClaireDiscovery(session, local), false);

  const nextSession = memoryStorage();
  assert.equal(shouldShowClaireDiscovery(nextSession, local), true);
  dismissClaireDiscovery(nextSession, local);
  assert.equal(local.getItem(CLAIRE_DISCOVERY_DISMISSED_KEY), "1");
  assert.equal(shouldShowClaireDiscovery(memoryStorage(), local), false);
});

test("Services tab maps to the home services section", () => {
  assert.equal(mobileTabForLocation("/index.html", "#services"), "services");
  assert.equal(mobileTabForLocation("/", ""), "accueil");
});

test("PiP geometry clamps to the usable rectangle", () => {
  const bounds = { left: 12, top: 88, right: 378, bottom: 760 };
  const size = { width: 76, height: 76 };
  assert.deepEqual(
    clampMobilePipPoint({ x: -40, y: 900 }, bounds, size),
    { x: 12, y: 684 }
  );
});

test("PiP position round-trips as usable-rectangle percentages", () => {
  const bounds = { left: 12, top: 88, right: 378, bottom: 760 };
  const size = { width: 76, height: 76 };
  const point = mobilePipPointFromPercent({ x: 0.25, y: 0.75 }, bounds, size);
  const position = mobilePipPercentFromPoint(point, bounds, size);
  assert.equal(position.x, 0.25);
  assert.equal(position.y, 0.75);
  assert.equal(MOBILE_PIP_STORAGE_KEY, "infoserv2a.claire.pip-position");
});

test("PiP uses a soft 20px edge magnet without forcing central positions", () => {
  const bounds = { left: 12, top: 88, right: 378, bottom: 760 };
  const size = { width: 76, height: 76 };
  assert.equal(MOBILE_PIP_EDGE_MAGNET_PX, 20);
  assert.deepEqual(
    magnetizeMobilePipPoint({ x: 30, y: 610 }, bounds, size),
    { x: 12, y: 610 }
  );
  assert.deepEqual(
    magnetizeMobilePipPoint({ x: 120, y: 300 }, bounds, size),
    { x: 120, y: 300 }
  );
});

test("PiP keeps sub-8px movement as a tap", () => {
  assert.equal(MOBILE_PIP_DRAG_THRESHOLD_PX, 8);
  assert.equal(mobilePipDragExceeded({ x: 10, y: 10 }, { x: 15, y: 15 }), false);
  assert.equal(mobilePipDragExceeded({ x: 10, y: 10 }, { x: 18, y: 10 }), true);
});

test("phone shell keeps PiP opt-in and renders it as a round medallion", async () => {
  const [css, client] = await Promise.all([
    readFile(new URL("../assets/css/claire-companion.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/js/claire-companion.js", import.meta.url), "utf8")
  ]);
  const shellMarkup = client.match(/shell\.innerHTML = `([\s\S]*?)`;/)?.[1] || "";
  assert.doesNotMatch(shellMarkup, /claire-mobile-pip/);
  assert.doesNotMatch(shellMarkup, /claire-mobile-sheet/);
  assert.match(shellMarkup, /Découvrir Claire/);
  assert.match(client, /dataset\.mobileFormClaire/);
  assert.match(client, /Aide Claire/);
  assert.match(client, /dataset\.mobilePipDismiss/);
  assert.match(client, /Rester en PiP/);
  assert.match(css, /data-claire-mobile-surface="site"[\s\S]*?display: none !important/);
  assert.match(css, /--claire-mobile-pip-size: 76px/);
  assert.match(
    css,
    /data-claire-mobile-surface="pip"[\s\S]*?\.claire-live-stage \{[\s\S]*?border-radius: 50%/
  );
  assert.match(css, /var\(--med-blue, #006c75\)/);
  assert.doesNotMatch(css, /gold|neon|glitter/i);
  assert.match(
    css,
    /data-claire-mobile-surface="guided"[\s\S]*?\.claire-live-stage \{[\s\S]*?border-radius: 0 !important/
  );
});

test("full Claire voice row sits between portrait and conversation", async () => {
  const [css, client] = await Promise.all([
    readFile(new URL("../assets/css/claire-companion.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/js/claire-companion.js", import.meta.url), "utf8")
  ]);
  assert.match(client, /this\.nodes\.stage\?\.after\(voiceRow\)/);
  assert.match(
    css,
    /data-claire-mobile-surface="claire"[\s\S]*?grid-template-rows: minmax\(190px, 30dvh\) 52px minmax\(0, 1fr\)/
  );
  assert.match(
    css,
    /data-claire-mobile-surface="claire"[\s\S]*?\.claire-live-stage__controls \{[\s\S]*?display: none !important/
  );
});

test("Quitter Claire compacts to PiP without stopping the duplex provider", async () => {
  globalThis.location = new URL("https://preprod.example/devis");
  globalThis.window = globalThis;
  globalThis.sessionStorage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, value); }
  };
  globalThis.document = {
    addEventListener() {},
    getElementById() { return null; }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  const calls = [];
  const context = {
    audioEnabled: true,
    provider: {
      connected: true,
      streamReady: true,
      listening: false,
      mediaAudible: false,
      async ensureActiveListening() {
        calls.push("duplex");
        this.listening = true;
        this.mediaAudible = true;
        return true;
      },
      async pauseListening() { calls.push("pause"); },
      async stop() { calls.push("stop"); }
    },
    mobileUx: { activeTab: "devis" },
    mobileChrome: { tabs: [] },
    nodes: { live: { textContent: "" } },
    interrupt() { calls.push("interrupt"); },
    releaseWakeLock() { calls.push("wake"); },
    hideSessionNotice() { calls.push("notice"); },
    clearSessionWatch() { calls.push("watch"); },
    clearMobileSceneTimer() { calls.push("timer"); },
    setState(value) { calls.push(`state:${value}`); },
    applyMobileSceneEvent(value) { calls.push(`scene:${value}`); },
    applyMobileUxEvent(event) { calls.push(`surface:${event.type}`); }
  };
  context.keepMobilePip = ClaireCompanion.prototype.keepMobilePip;
  await ClaireCompanion.prototype.exitMobileClaire.call(context);
  assert.ok(calls.includes("duplex"));
  assert.ok(!calls.includes("interrupt"));
  assert.ok(!calls.includes("pause"));
  assert.ok(!calls.includes("stop"));
  assert.equal(context.audioEnabled, true);
  assert.ok(calls.includes("state:guided"));
  assert.ok(calls.includes("surface:show-pip"));
});

test("Rester en PiP keeps listening and remote audio without interrupting speech", async () => {
  const calls = [];
  const context = {
    audioEnabled: true,
    provider: {
      connected: true,
      streamReady: true,
      listening: true,
      mediaAudible: true,
      async ensureActiveListening(options) {
        calls.push(["duplex", options]);
        return this.listening && this.mediaAudible;
      },
      async pauseListening() { calls.push("pause"); },
      async stop() { calls.push("stop"); }
    },
    mobileChrome: { pipDismiss: { focus() { calls.push("focus"); } } },
    interrupt() { calls.push("interrupt"); },
    releaseWakeLock() { calls.push("wake"); },
    hideSessionNotice() { calls.push("notice"); },
    clearMobileSceneTimer() { calls.push("timer"); },
    setState(value) { calls.push(`state:${value}`); },
    applyMobileSceneEvent(value) { calls.push(`scene:${value}`); },
    applyMobileUxEvent(event) { calls.push(`surface:${event.type}`); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  await ClaireCompanion.prototype.keepMobilePip.call(context);
  assert.ok(!calls.includes("pause"));
  assert.ok(!calls.includes("stop"));
  assert.ok(!calls.includes("interrupt"));
  assert.equal(calls.some((call) => Array.isArray(call)), false);
  assert.equal(context.provider.listening, true);
  assert.equal(context.provider.mediaAudible, true);
  assert.equal(context.audioEnabled, true);
  assert.ok(calls.includes("surface:show-pip"));
});

test("ouvrir l’onglet Claire reprend toujours le micro déjà autorisé", async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const calls = [];
  const context = {
    audioEnabled: false,
    provider: {
      connected: true,
      streamReady: true,
      listening: false,
      async resumeMedia() { calls.push("media"); },
      async ensureActiveListening() {
        calls.push("listen");
        this.listening = true;
        return true;
      }
    },
    hideMobileDiscovery() { calls.push("hide"); },
    applyMobileUxEvent(event) { calls.push(`surface:${event.type}`); },
    setState(value) { calls.push(`state:${value}`); },
    setStatus(value) { calls.push(`status:${value}`); },
    async connectLiveSession() { calls.push("connect"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  const opened = await ClaireCompanion.prototype.openMobileClaire.call(context);
  assert.equal(opened, true);
  assert.equal(context.audioEnabled, true);
  assert.ok(calls.includes("listen"));
  assert.ok(!calls.includes("connect"));
  assert.ok(calls.includes("status:listening"));
});

test("ouvrir Claire ne déclare pas la reprise réussie si la sortie avatar reste muette", async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const calls = [];
  const context = {
    audioEnabled: false,
    provider: {
      connected: true,
      streamReady: true,
      listening: false,
      mediaAudible: false,
      async ensureActiveListening() {
        calls.push("listen");
        this.listening = true;
        return false;
      }
    },
    hideMobileDiscovery() {},
    applyMobileUxEvent() {},
    setState() {},
    setStatus(value) { calls.push(`status:${value}`); },
    async connectLiveSession() { calls.push("connect"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  const opened = await ClaireCompanion.prototype.openMobileClaire.call(context);
  assert.equal(opened, false);
  assert.deepEqual(calls, ["listen", "connect"]);
});

test("le retour de visibilité ne reconnecte jamais LiveAvatar sans geste utilisateur", async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const originalDocument = globalThis.document;
  globalThis.document = { visibilityState: "visible" };
  const calls = [];
  const context = {
    state: "shared",
    audioEnabled: true,
    mobileUx: { surface: "claire" },
    provider: {
      connected: false,
      async ensureActiveListening(options) {
        calls.push(["listen", options]);
        return false;
      }
    },
    syncViewportShell() { calls.push(["viewport"]); },
    async keepScreenAwake() { calls.push(["wake"]); },
    releaseWakeLock() { calls.push(["release"]); },
    async connectLiveSession() { calls.push(["connect"]); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  await ClaireCompanion.prototype.handleVisibility.call(context);
  assert.deepEqual(calls, [
    ["viewport"],
    ["wake"],
    ["listen", { allowReconnect: false }]
  ]);
  globalThis.document = originalDocument;
});

test("sur iPad, toucher Claire déverrouille une réponse muette au lieu de l’interrompre", async () => {
  const calls = [];
  const context = {
    provider: {
      avatarSpeaking: true,
      mediaAudible: false,
      needsAudioUnlock: () => true,
      async resumeMedia() {
        calls.push("resume");
        this.mediaAudible = true;
        return true;
      }
    },
    interrupt() { calls.push("interrupt"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  assert.equal(await ClaireCompanion.prototype.handleAvatarStageGesture.call(context), true);
  assert.deepEqual(calls, ["resume"]);

  context.provider.needsAudioUnlock = () => false;
  assert.equal(
    await ClaireCompanion.prototype.handleAvatarStageGesture.call(context),
    "interrupted"
  );
  assert.deepEqual(calls, ["resume", "interrupt"]);
});

test("le premier tap iPad retire muted avant même que le provider soit chargé", async () => {
  const attributes = new Set(["muted"]);
  const video = {
    muted: true,
    defaultMuted: true,
    paused: true,
    volume: 0,
    setAttribute(name) { attributes.add(name); },
    removeAttribute(name) { attributes.delete(name); },
    play: async () => { throw new Error("Flux pas encore attaché"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  ClaireCompanion.prototype.prepareLocalVideo.call({ nodes: { video } });
  await Promise.resolve();
  assert.equal(video.playsInline, true);
  assert.equal(video.autoplay, true);
  assert.equal(video.defaultMuted, false);
  assert.equal(video.muted, false);
  assert.equal(video.volume, 1);
  assert.equal(attributes.has("muted"), false);
  assert.equal(attributes.has("playsinline"), true);
  assert.equal(attributes.has("webkit-playsinline"), true);
});

test("sur iPad, Parler déverrouille d’abord le haut-parleur sans couper Claire", async () => {
  const calls = [];
  const context = {
    audioEnabled: false,
    state: "guided",
    provider: {
      connected: true,
      avatarSpeaking: true,
      mediaAudible: false,
      primeAudio() { calls.push("prime"); },
      needsAudioUnlock: () => true,
      async resumeMedia() {
        calls.push("resume");
        this.mediaAudible = true;
        return true;
      },
      async toggleListening() { calls.push("toggle"); }
    },
    prepareLocalVideo() { calls.push("prepare"); },
    async preflightMicrophone() { calls.push("preflight"); },
    setStatus(state) { calls.push(`status:${state}`); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  assert.equal(await ClaireCompanion.prototype.toggleMicrophone.call(context), true);
  assert.deepEqual(calls, ["prepare", "prime", "resume", "status:speaking"]);
  assert.equal(context.audioEnabled, true);
});

test("taper le médaillon live ouvre Claire sans avoir interrompu l’écoute", async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const calls = [];
  const context = {
    audioEnabled: true,
    provider: {
      connected: true,
      streamReady: true,
      listening: true,
      async pauseListening() { calls.push("pause"); this.listening = false; },
      async resumeMedia() { calls.push("media"); },
      async ensureActiveListening() {
        calls.push("listen");
        this.listening = true;
        return true;
      }
    },
    mobileChrome: { pipDismiss: { focus() {} } },
    interrupt() { calls.push("interrupt"); },
    releaseWakeLock() {},
    hideSessionNotice() {},
    clearMobileSceneTimer() {},
    hideMobileDiscovery() {},
    setState() {},
    setStatus() {},
    applyMobileSceneEvent() {},
    applyMobileUxEvent(event) { calls.push(`surface:${event.type}`); },
    async connectLiveSession() { calls.push("connect"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  await ClaireCompanion.prototype.keepMobilePip.call(context, { restoreFocus: false });
  assert.equal(context.provider.listening, true);
  const opened = await ClaireCompanion.prototype.openMobileClaire.call(context);
  assert.equal(opened, true);
  assert.equal(calls.includes("pause"), false);
  assert.deepEqual(calls.filter((call) => call === "listen"), ["listen"]);
  assert.ok(calls.includes("surface:show-pip"));
  assert.ok(calls.includes("surface:open-claire"));
});

test("Voir le site laisse le médaillon avec Claire toujours en écoute", async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const calls = [];
  const context = {
    audioEnabled: true,
    provider: {
      connected: true,
      streamReady: true,
      listening: true,
      async pauseListening() { calls.push("pause"); this.listening = false; },
      async resumeMedia() {},
      async ensureActiveListening() {
        calls.push("listen");
        this.listening = true;
        return true;
      }
    },
    mobileChrome: {},
    interrupt() {},
    releaseWakeLock() {},
    hideSessionNotice() {},
    clearMobileSceneTimer() {},
    hideMobileDiscovery() {},
    setState() {},
    setStatus() {},
    applyMobileSceneEvent() {},
    applyMobileUxEvent(event) { calls.push(`surface:${event.type}`); },
    async connectLiveSession() { calls.push("connect"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  context.keepMobilePip = ClaireCompanion.prototype.keepMobilePip;
  await ClaireCompanion.prototype.dismissMobileGuided.call(context);
  assert.equal(context.provider.listening, true);
  assert.equal(calls.includes("pause"), false);
  assert.ok(calls.includes("surface:show-pip"));
  await ClaireCompanion.prototype.openMobileClaire.call(context);
  assert.equal(context.provider.listening, true);
  assert.ok(calls.includes("listen"));
});

test("showMobileSite conserve le PiP duplex même pendant une connexion", async () => {
  globalThis.matchMedia = () => ({ matches: true });
  const calls = [];
  const context = {
    audioEnabled: true,
    provider: { connected: false },
    keepMobilePip(options) {
      calls.push(["pip", options]);
      return Promise.resolve(true);
    },
    applyMobileUxEvent(event) { calls.push(["surface", event.type]); },
    setState(value) { calls.push(["state", value]); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  assert.equal(
    await ClaireCompanion.prototype.showMobileSite.call(context),
    true
  );
  assert.deepEqual(calls, [["pip", { restoreFocus: false }]]);
});

test("PiP X fully stops and evacuates Claire without clearing memory", async () => {
  const calls = [];
  const context = {
    audioEnabled: true,
    provider: {
      async pauseListening() { calls.push("pause"); },
      async stop() { calls.push("stop"); }
    },
    mobileUx: { activeTab: "accueil" },
    mobileChrome: { tabs: [] },
    nodes: { live: { textContent: "" } },
    interrupt() { calls.push("interrupt"); },
    releaseWakeLock() {},
    hideSessionNotice() {},
    clearSessionWatch() {},
    clearMobileSceneTimer() {},
    setState() {},
    applyMobileSceneEvent() {},
    applyMobileUxEvent(event) { calls.push(`surface:${event.type}`); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  context.exitMobileClaire = ClaireCompanion.prototype.exitMobileClaire;
  await ClaireCompanion.prototype.evacuateMobilePip.call(context);
  assert.ok(!calls.includes("pause"));
  assert.ok(calls.includes("stop"));
  assert.ok(calls.includes("surface:evacuate-pip"));
  assert.match(context.nodes.live.textContent, /mémorisée/);
});

test("un tap sur le médaillon réarme son et micro sans quitter le PiP", async () => {
  const calls = [];
  const context = {
    audioEnabled: false,
    provider: {
      connected: true,
      streamReady: true,
      listening: false,
      mediaAudible: false,
      avatarSpeaking: false,
      needsAudioUnlock: () => true,
      primeAudio() { calls.push("prime"); },
      async ensureActiveListening(options) {
        calls.push(["duplex", options]);
        this.listening = true;
        this.mediaAudible = true;
        return true;
      }
    },
    prepareLocalVideo() { calls.push("video"); },
    async preflightMicrophone() { calls.push("preflight"); },
    setStatus(state) { calls.push(`status:${state}`); },
    async openMobileClaire() { calls.push("open"); }
  };
  const { ClaireCompanion } = await import("../assets/js/claire-companion.js");
  const armed = await ClaireCompanion.prototype.handleMobilePipTap.call(context);
  assert.equal(armed, true);
  assert.equal(context.audioEnabled, true);
  assert.equal(context.provider.listening, true);
  assert.equal(context.provider.mediaAudible, true);
  assert.equal(calls.includes("open"), false);
  assert.deepEqual(calls, [
    "video",
    "prime",
    "preflight",
    ["duplex", { allowReconnect: true }],
    "status:listening"
  ]);
});
