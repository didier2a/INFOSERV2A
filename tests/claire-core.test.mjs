import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  currentPage,
  normalizeText,
  pageHrefForSession,
  routeCommand,
  scorePage
} from "../assets/js/claire-core.mjs";

const knowledge = JSON.parse(
  await readFile(new URL("../data/site-knowledge.json", import.meta.url), "utf8")
);

test("normalise le français sans perdre les termes techniques", () => {
  assert.equal(normalizeText("  Audit NIS 2 — Réseau & IA  "), "audit nis 2 reseau ia");
});

test("référence toutes les pages publiques du site", () => {
  assert.equal(knowledge.pages.length, 13);
  assert.equal(new Set(knowledge.pages.map((page) => page.href)).size, 13);
  assert.ok(knowledge.pages.every((page) => page.title && page.summary && page.keywords.length));
});

test("trouve la vidéosurveillance sans fibre", () => {
  const result = routeCommand("Je cherche une caméra sans fibre", knowledge);
  assert.equal(result.type, "suggest");
  assert.equal(result.page.id, "videosurveillance");
});

test("ouvre directement l’audit NIS 2 sur une commande explicite", () => {
  const result = routeCommand("Ouvre l’audit NIS 2", knowledge);
  assert.equal(result.type, "navigate");
  assert.equal(result.page.id, "cybersecurity");
  assert.equal(result.href, "cybersecurite-ia.html#audit-nis2");
});

test("route un disque inaccessible vers la récupération de données", () => {
  const result = routeCommand("Mon disque dur est inaccessible", knowledge);
  assert.equal(result.page.id, "data-recovery");
});

test("ne déclenche pas automatiquement un appel", () => {
  const result = routeCommand("Appeler InfoServ2A", knowledge);
  assert.equal(result.type, "action");
  assert.equal(result.action, "call");
  assert.match(result.href, /^tel:/);
});

test("restitue immédiatement la navigation manuelle", () => {
  const result = routeCommand("Je préfère le mode manuel", knowledge);
  assert.equal(result.type, "manual");
});

test("explique la page courante", () => {
  const result = routeCommand("Explique cette page", knowledge, { pathname: "/creation-site-web.html" });
  assert.equal(result.type, "answer");
  assert.equal(result.page.id, "web");
});

test("identifie l’accueil avec les deux formes d’URL", () => {
  assert.equal(currentPage(knowledge, "/")?.id, "home");
  assert.equal(currentPage(knowledge, "/index.html")?.id, "home");
});

test("conserve Claire pendant une navigation interne", () => {
  assert.equal(
    pageHrefForSession("cybersecurite-ia.html#audit-nis2", "shared"),
    "cybersecurite-ia.html?claire=continue#audit-nis2"
  );
});

test("privilégie un titre et ses mots-clés", () => {
  const web = knowledge.pages.find((page) => page.id === "web");
  const legal = knowledge.pages.find((page) => page.id === "legal");
  assert.ok(scorePage("refonte site web", web) > scorePage("refonte site web", legal));
});
