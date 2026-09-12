import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MOBILE_PIP_DRAG_THRESHOLD_PX,
  MOBILE_PIP_EDGE_MAGNET_PX,
  MOBILE_PIP_STORAGE_KEY,
  MOBILE_SURFACES,
  PHONE_MEDIA_QUERY,
  clampMobilePipPoint,
  createMobileUxState,
  magnetizeMobilePipPoint,
  mobilePipDragExceeded,
  mobilePipPercentFromPoint,
  mobilePipPointFromPercent,
  mobileTabForLocation,
  mobileUxLocksScroll,
  reduceMobileUx
} from "../assets/js/claire-mobile-ux.mjs";

test("smartphone shell starts on the site with PiP and Accueil active", () => {
  const state = createMobileUxState({ pathname: "/", hash: "" });
  assert.equal(PHONE_MEDIA_QUERY, "(max-width: 768px)");
  assert.equal(state.surface, MOBILE_SURFACES.PIP);
  assert.equal(state.activeTab, "accueil");
  assert.equal(mobileUxLocksScroll(state), false);
});

test("devis and contact routes automatically use the Claire sheet", () => {
  for (const pathname of ["/devis.html", "/contact.html"]) {
    const state = reduceMobileUx(createMobileUxState(), { type: "route", pathname });
    assert.equal(state.surface, MOBILE_SURFACES.SHEET);
    assert.equal(state.activeTab, "devis");
    assert.equal(state.sheetExpanded, false);
  }
});

test("Claire tab is full, then Voir le site returns to PiP", () => {
  let state = createMobileUxState({ pathname: "/videosurveillance.html" });
  state = reduceMobileUx(state, { type: "open-claire" });
  assert.equal(state.surface, MOBILE_SURFACES.CLAIRE);
  assert.equal(state.activeTab, "claire");
  state = reduceMobileUx(state, {
    type: "show-site",
    pathname: "/videosurveillance.html"
  });
  assert.equal(state.surface, MOBILE_SURFACES.PIP);
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
  assert.equal(state.surface, MOBILE_SURFACES.PIP);
  assert.equal(mobileUxLocksScroll(state), false);
});

test("only an expanded sheet locks site scrolling", () => {
  let state = createMobileUxState({ pathname: "/devis.html" });
  assert.equal(state.surface, MOBILE_SURFACES.SHEET);
  assert.equal(mobileUxLocksScroll(state), false);
  state = reduceMobileUx(state, { type: "expand-sheet" });
  assert.equal(mobileUxLocksScroll(state), true);
  state = reduceMobileUx(state, { type: "collapse-sheet" });
  assert.equal(mobileUxLocksScroll(state), false);
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

test("phone CSS overrides the legacy top strip and duplicate guided controls", async () => {
  const [css, client] = await Promise.all([
    readFile(new URL("../assets/css/claire-companion.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/js/claire-companion.js", import.meta.url), "utf8")
  ]);
  assert.match(
    css,
    /data-claire-mobile-surface="pip"[\s\S]*?inset:[^;]+!important;[\s\S]*?width: var\(--claire-mobile-pip-width\) !important/
  );
  assert.match(
    css,
    /data-claire-mobile-surface="guided"[\s\S]*?\.claire-shop-return,[\s\S]*?\.claire-scene-write \{[\s\S]*?display: none !important/
  );
  assert.match(css, /data-claire-mobile-surface="pip"[\s\S]*?touch-action: none/);
  assert.match(client, /setPointerCapture\(event\.pointerId\)/);
  assert.match(client, /storageSet\(MOBILE_PIP_STORAGE_KEY/);
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
