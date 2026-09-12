import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolveInitialClaireState } from "../assets/js/claire-initial-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("a fresh phone visit opens the co-branded choice, while desktop keeps arrival", () => {
  assert.equal(resolveInitialClaireState({ phone: true }), "choice");
  assert.equal(resolveInitialClaireState({ phone: false }), "arrival");
});

test("explicit and persisted Claire choices still take precedence on phone", () => {
  assert.equal(resolveInitialClaireState({ phone: true, requested: "1" }), "arrival");
  assert.equal(resolveInitialClaireState({ phone: true, requested: "start" }), "arrival");
  assert.equal(resolveInitialClaireState({ phone: true, storedMode: "guided" }), "guided");
  assert.equal(resolveInitialClaireState({ phone: true, storedMode: "shared" }), "guided");
  assert.equal(resolveInitialClaireState({ phone: true, storedMode: "manual" }), "manual");
  assert.equal(resolveInitialClaireState({ phone: true, seen: true }), "manual");
});

test("the mobile choice presents both co-brands and two equal action doors", async () => {
  const [header, css] = await Promise.all([
    readFile(path.join(ROOT, "partials/header.html"), "utf8"),
    readFile(path.join(ROOT, "assets/css/claire-companion.css"), "utf8")
  ]);

  assert.match(header, /InfoServ2A —[\s\S]*votre expert local à Porto-Vecchio/);
  assert.match(header, /Claire,[\s\S]*assistante numérique de Didier/);
  assert.match(
    header,
    /<button class="claire-mobile-choice__button claire-mobile-choice__button--site"[^>]*data-claire-manual[^>]*data-claire-choice-manual>Découvrir InfoServ2A<\/button>/
  );
  assert.match(
    header,
    /<button class="claire-mobile-choice__button claire-mobile-choice__button--claire"[^>]*data-claire-start>Échanger avec Claire<\/button>/
  );
  assert.match(css, /\.claire-mobile-choice__actions \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);

  const choiceBodyRules = [...css.matchAll(/body\.claire-choice-open[^{]*\{([^}]*)\}/g)];
  assert.ok(choiceBodyRules.length > 0);
  choiceBodyRules.forEach((rule) => assert.doesNotMatch(rule[1], /overflow\s*:\s*hidden/));
});
