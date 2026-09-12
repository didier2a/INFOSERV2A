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

test("Claire tab is full, then Quitter returns to the classic site", () => {
  let state = createMobileUxState({ pathname: "/videosurveillance.html" });
  state = reduceMobileUx(state, { type: "open-claire" });
  assert.equal(state.surface, MOBILE_SURFACES.CLAIRE);
  assert.equal(state.activeTab, "claire");
  state = reduceMobileUx(state, {
    type: "show-site",
    pathname: "/videosurveillance.html"
  });
  assert.equal(state.surface, MOBILE_SURFACES.SITE);
  assert.equal(state.activeTab, "services");
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
  const size = { width: 104, height: 136 };
  assert.deepEqual(
    clampMobilePipPoint({ x: -40, y: 900 }, bounds, size),
    { x: 12, y: 624 }
  );
});

test("PiP position round-trips as usable-rectangle percentages", () => {
  const bounds = { left: 12, top: 88, right: 378, bottom: 760 };
  const size = { width: 104, height: 136 };
  const point = mobilePipPointFromPercent({ x: 0.25, y: 0.75 }, bounds, size);
  const position = mobilePipPercentFromPoint(point, bounds, size);
  assert.equal(position.x, 0.25);
  assert.equal(position.y, 0.75);
  assert.equal(MOBILE_PIP_STORAGE_KEY, "infoserv2a.claire.pip-position");
});

test("PiP uses a soft 20px edge magnet without forcing central positions", () => {
  const bounds = { left: 12, top: 88, right: 378, bottom: 760 };
  const size = { width: 104, height: 136 };
  assert.equal(MOBILE_PIP_EDGE_MAGNET_PX, 20);
  assert.deepEqual(
    magnetizeMobilePipPoint({ x: 30, y: 610 }, bounds, size),
    { x: 12, y: 624 }
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

test("phone shell has no generated PiP or form sheet default", async () => {
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
  assert.match(css, /data-claire-mobile-surface="site"[\s\S]*?display: none !important/);
  assert.match(css, /var\(--med-blue, #006c75\)/);
  assert.doesNotMatch(css, /gold|neon|glitter/i);
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

test("Quitter Claire stops provider and microphone while keeping memory", async () => {
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
  await ClaireCompanion.prototype.exitMobileClaire.call(context);
  assert.deepEqual(calls.slice(0, 7), [
    "interrupt", "wake", "notice", "watch", "timer", "pause", "stop"
  ]);
  assert.equal(context.audioEnabled, false);
  assert.match(context.nodes.live.textContent, /mémorisée/);
  assert.ok(calls.includes("state:manual"));
  assert.ok(calls.includes("surface:show-site"));
});
