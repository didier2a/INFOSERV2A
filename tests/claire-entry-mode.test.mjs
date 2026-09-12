import assert from "node:assert/strict";
import test from "node:test";
import { resolveInitialClaireState } from "../assets/js/claire-entry-mode.mjs";

test("un premier passage téléphone ouvre le choix co-brandé", () => {
  assert.equal(resolveInitialClaireState({ phone: true }), "choice");
});

test("les écrans larges conservent l’arrivée Claire", () => {
  assert.equal(resolveInitialClaireState({ phone: false }), "arrival");
});

test("les choix déjà faits et les liens explicites gardent leur comportement", () => {
  assert.equal(resolveInitialClaireState({ phone: true, seen: true }), "manual");
  assert.equal(resolveInitialClaireState({ phone: true, storedMode: "guided" }), "guided");
  assert.equal(resolveInitialClaireState({ phone: true, requested: "start" }), "arrival");
});
