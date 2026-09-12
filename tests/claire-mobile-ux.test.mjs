import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_SURFACES,
  PHONE_MEDIA_QUERY,
  createMobileUxState,
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
