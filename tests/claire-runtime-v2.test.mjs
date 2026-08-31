import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ClaireRuntimeController,
  planCommand
} from "../assets/js/claire-runtime-v2.mjs";
import { InfoServ2ALabAdapter } from "../assets/js/claire-site-adapter.mjs";

const knowledge = JSON.parse(
  await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8")
);
const manifest = JSON.parse(
  await readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8")
);

test("le manifeste P0 n’expose que les cinq outils déclarés", () => {
  assert.deepEqual(
    manifest.tools.map((tool) => tool.name),
    ["search_site", "open_service", "scroll_to", "open_contact", "prefill_quote"]
  );
  assert.equal(manifest.mode, "text-only");
  assert.equal(manifest.guardrails.allowDirectDomFromModel, false);
  assert.equal(manifest.guardrails.allowFormSubmission, false);
});

test("le scénario sans fibre produit le plan canonique exact", () => {
  const plan = planCommand(
    "Affiche les solutions de vidéosurveillance sans fibre.",
    knowledge,
    manifest
  );
  assert.deepEqual(
    plan.steps.map((step) => step.tool),
    ["search_site", "open_service", "scroll_to"]
  );
  assert.deepEqual(plan.expected, {
    pageId: "videosurveillance",
    anchorId: "solutions-sans-fibre"
  });
  assert.equal(
    plan.response,
    "Voici les solutions 4G, 5G et solaires adaptées aux sites sans fibre."
  );
});

test("le contrôleur exécute, vérifie et journalise une seule action à la fois", async () => {
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({
    knowledge,
    manifest,
    adapter,
    clock: () => "2026-08-31T00:00:00.000Z"
  });
  const outcome = await controller.run(
    "Affiche les solutions de vidéosurveillance sans fibre."
  );
  assert.equal(outcome.state, "complete");
  assert.equal(outcome.verification.ok, true);
  assert.deepEqual(
    outcome.results.map((result) => result.tool),
    ["search_site", "open_service", "scroll_to"]
  );
  assert.deepEqual(
    controller.events
      .filter((event) => event.type === "state.changed")
      .map((event) => event.payload.next),
    ["interpreting", "planning", "executing", "verifying", "complete"]
  );
  const snapshot = adapter.snapshot();
  assert.equal(snapshot.activePage, "videosurveillance");
  assert.equal(snapshot.activeSection, "solutions-sans-fibre");
});

test("une deuxième commande est refusée tant que la première est active", async () => {
  let release;
  let calls = 0;
  const adapter = {
    execute() {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          release = () => resolve({ ok: true });
        });
      }
      return Promise.resolve({ ok: true });
    },
    verify() {
      return Promise.resolve({ ok: true });
    }
  };
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const first = controller.run("Affiche les solutions de vidéosurveillance sans fibre.");
  await Promise.resolve();
  await Promise.resolve();
  await assert.rejects(
    controller.run("Ouvre l’audit NIS 2."),
    /déjà en cours/
  );
  release();
  await first;
});

test("le contact est affiché sans déclencher appel ou email", async () => {
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Je voudrais vous contacter par email.");
  const snapshot = adapter.snapshot();
  assert.equal(outcome.verification.ok, true);
  assert.equal(outcome.verification.pageId, "contact");
  assert.equal(snapshot.activePage, "contact");
  assert.equal(snapshot.contactChannel, "email");
  assert.equal(snapshot.submitted, false);
});

test("le devis reste un brouillon non soumis", async () => {
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  const outcome = await controller.run("Ouvre le formulaire de devis.");
  assert.ok(outcome.plan.steps.some((step) => step.tool === "prefill_quote"));
  const snapshot = adapter.snapshot();
  assert.equal(snapshot.activePage, "quote");
  assert.equal(snapshot.submitted, false);
  assert.equal(snapshot.quoteDraft.description, "Ouvre le formulaire de devis.");
});

test("l’ancre canonique existe dans la page publique", async () => {
  const html = await readFile(
    new URL("../videosurveillance.html", import.meta.url),
    "utf8"
  );
  assert.match(html, /id="solutions-sans-fibre"/);
});

test("le laboratoire ne charge ni fournisseur temps réel ni secret client", async () => {
  const [html, client, manifestSource] = await Promise.all([
    readFile(new URL("../claire-lab.html", import.meta.url), "utf8"),
    readFile(new URL("../assets/js/claire-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../data/claire-capabilities.json", import.meta.url), "utf8")
  ]);
  const source = html + client + manifestSource;
  assert.doesNotMatch(html, /claire-companion\.js|claire-liveavatar-provider|api\/liveavatar/i);
  assert.doesNotMatch(client, /openai|livekit|liveavatar/i);
  assert.doesNotMatch(source, /\bsk-[A-Za-z0-9_-]{20,}\b/);
  assert.doesNotMatch(source, /_API_KEY/);
});
