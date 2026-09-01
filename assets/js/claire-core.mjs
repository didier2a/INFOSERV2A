const FRENCH_STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle",
  "en", "et", "est", "je", "la", "le", "les", "ma", "mes", "mon", "nous",
  "ou", "par", "pas", "pour", "que", "qui", "sur", "tu", "un", "une", "vous"
]);

const DIRECT_INTENTS = [
  {
    id: "manual",
    pattern: /\b(mode manuel|navigation manuelle|naviguer manuellement|sans claire|ferme(?:r)? claire)\b/,
    response: {
      type: "manual",
      speech: "Je vous rends immédiatement la navigation classique. Vous pourrez me rappeler à tout moment."
    }
  },
  {
    id: "recall",
    pattern: /\b(rappelle claire|ouvre claire|parler a claire|retour claire)\b/,
    response: {
      type: "recall",
      speech: "Je suis de nouveau avec vous. Que souhaitez-vous trouver ?"
    }
  },
  {
    id: "call",
    pattern: /\b(appel(?:er|le)?|telephone(?:r)?|numero de telephone)\b/,
    response: {
      type: "action",
      action: "call",
      href: "tel:+33745156076",
      label: "Appeler le 07 45 15 60 76",
      speech: "Vous pouvez appeler InfoServ2A au 07 45 15 60 76, du lundi au samedi. Je vous laisse confirmer l’appel."
    }
  },
  {
    id: "email",
    pattern: /\b(e-?mail|courriel|adresse mail|envoyer un message)\b/,
    response: {
      type: "action",
      action: "email",
      href: "mailto:contact@infoserv2a.pro",
      label: "Écrire à contact@infoserv2a.pro",
      speech: "L’adresse est contact@infoserv2a.pro. Je vous laisse confirmer l’ouverture de votre messagerie."
    }
  }
];

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9+#.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function meaningfulTokens(value = "") {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length > 1 && !FRENCH_STOP_WORDS.has(token));
}

function fieldText(page) {
  const anchors = Array.isArray(page.anchors) ? page.anchors : [];
  return {
    title: normalizeText(page.title),
    keywords: normalizeText((page.keywords || []).join(" ")),
    summary: normalizeText(page.summary),
    anchors: normalizeText(anchors.map((anchor) => `${anchor.label} ${(anchor.keywords || []).join(" ")}`).join(" "))
  };
}

function phraseBonus(query, haystack, weight) {
  return query.length >= 4 && haystack.includes(query) ? weight : 0;
}

export function scorePage(query, page) {
  const normalized = normalizeText(query);
  const tokens = meaningfulTokens(normalized);
  const fields = fieldText(page);
  let score = 0;

  score += phraseBonus(normalized, fields.title, 18);
  score += phraseBonus(normalized, fields.keywords, 14);
  score += phraseBonus(normalized, fields.anchors, 12);
  score += phraseBonus(normalized, fields.summary, 8);

  tokens.forEach((token) => {
    if (fields.title.includes(token)) score += 7;
    if (fields.keywords.includes(token)) score += 6;
    if (fields.anchors.includes(token)) score += 5;
    if (fields.summary.includes(token)) score += 2;
  });

  return score;
}

function findAnchor(query, page) {
  const anchors = Array.isArray(page.anchors) ? page.anchors : [];
  let best = null;
  let bestScore = 0;
  anchors.forEach((anchor) => {
    const score = scorePage(query, {
      title: anchor.label,
      summary: "",
      keywords: anchor.keywords || [],
      anchors: []
    });
    if (score > bestScore) {
      best = anchor;
      bestScore = score;
    }
  });
  return bestScore >= 5 ? best : null;
}

export function isExplicitNavigation(value = "") {
  const query = normalizeText(value);
  return /^(ouvre|va|allez|affiche|montre|emmene|guide|accede|lance|conduis)\b/.test(query)
    || /\b(ouvre|affiche|montre moi|va a|allez a|emmene moi|guide moi)\b/.test(query);
}

export function isIsolatedSiteRequest(value = "") {
  return /\b(sans (fibre|internet|electricite|connexion|box)|pas (?:d[' ]?)?internet|pas de (fibre|connexion|box|reseau)|zone blanche|site isole)\b/.test(normalizeText(value));
}

export function isWebSiteRequest(value = "") {
  return /\b(site (web|internet|vitrine)|creer un site|refonte|hebergement)\b/.test(normalizeText(value));
}

export function isQuoteAction(value = "") {
  const query = normalizeText(value);
  return /\bformulaire de devis\b/.test(query)
    || /\b(je (?:voudrais|veux|souhaite)|j ai besoin|faire|ouvrir|affiche|montre|demande).{0,40}devis\b/.test(query)
    || /\bdevis (?:gratuit|s il vous plait|svp)\b/.test(query);
}

export function isContactAction(value = "") {
  const query = normalizeText(value);
  return /\b(contacter|prendre contact|vous joindre|coordonnees)\b/.test(query)
    || (isExplicitNavigation(value) && /\bcontact\b/.test(query));
}

export function isCatalogRequest(value = "") {
  return /\b(catalogue|(?:tous )?les onglets|toutes les (?:pages|rubriques)|(?:quels?|quelles?) (?:sont )?(?:les )?(?:pages|onglets|rubriques)|liste des (?:onglets|pages)|onglets du site)\b/.test(normalizeText(value));
}

export function isNextTabRequest(value = "") {
  return /\b((?:onglet|page|rubrique) suivant(?:e)?|suivant(?:e)? (?:onglet|page|rubrique)|prochain onglet)\b/.test(normalizeText(value));
}

export function isPrevTabRequest(value = "") {
  return /\b((?:onglet|page|rubrique) precedent(?:e)?|precedent(?:e)? (?:onglet|page|rubrique)|onglet d avant)\b/.test(normalizeText(value));
}

export function isNextSectionRequest(value = "") {
  return /\b((?:section|partie) suivante|plus bas|fais defiler|defile)\b/.test(normalizeText(value));
}

export function isPrevSectionRequest(value = "") {
  return /\b((?:section|partie) precedente|plus haut|remonte)\b/.test(normalizeText(value));
}

export function isHomeTabRequest(value = "") {
  const query = normalizeText(value);
  return /\b(page d accueil|onglet accueil|retour (?:a l )?accueil)\b/.test(query)
    || (isExplicitNavigation(value) && /\baccueil\b/.test(query));
}

export const CATALOG_TOOL_NAMES = Object.freeze([
  "search_site",
  "open_service",
  "scroll_to",
  "open_contact",
  "prefill_quote",
  "list_catalog",
  "explain_page",
  "go_home",
  "next_page",
  "prev_page",
  "next_section",
  "prev_section"
]);

export function pageById(knowledge, id) {
  return (knowledge.pages || []).find((page) => page.id === id) || null;
}

export function adjacentPage(knowledge, pageId, direction = 1) {
  const pages = knowledge.pages || [];
  if (!pages.length) return null;
  const idx = pages.findIndex((page) => page.id === pageId);
  const start = idx < 0 ? 0 : idx;
  const next = start + direction;
  if (next < 0) return pages[pages.length - 1];
  if (next >= pages.length) return pages[0];
  return pages[next];
}

export function adjacentSection(page, sectionId, direction = 1) {
  const anchors = page?.anchors || [];
  if (!anchors.length) return null;
  const idx = anchors.findIndex((anchor) => anchor.id === sectionId);
  if (idx < 0) return direction > 0 ? anchors[0] : anchors[anchors.length - 1];
  return anchors[idx + direction] || null;
}

export function resolveCurrentPage(knowledge, context = {}) {
  if (context.pageId) return pageById(knowledge, context.pageId);
  return currentPage(knowledge, context.pathname || "/");
}

export function catalogEntries(knowledge) {
  return (knowledge.pages || []).map((page, index) => ({
    index: index + 1,
    id: page.id,
    title: page.title,
    href: page.href,
    summary: page.summary,
    sections: (page.anchors || []).map((anchor) => ({ id: anchor.id, label: anchor.label }))
  }));
}

export function buildSiteBriefing(knowledge) {
  const identity = knowledge.identity || {};
  const entries = catalogEntries(knowledge);
  const lines = entries.map((entry) => {
    const sections = entry.sections.map((section) => section.label).join(", ");
    return `${entry.index}. Onglet « ${entry.title} » (${entry.id}) : ${entry.summary}${sections ? ` Sections : ${sections}.` : ""}`;
  });
  return [
    "Tu es généraliste, comme OpenAI Live. LiveAvatar n’est que ton visage et ta voix. Le site InfoServ2A est un catalogue d’onglets que tu peux ouvrir, sans t’y limiter.",
    `Entreprise : ${knowledge.site || "InfoServ2A"}. Zone : ${identity.area || ""}. Téléphone : ${identity.phone || ""}. Horaires : ${identity.hours || ""}. Email : ${identity.email || ""}.`,
    "Catalogue des onglets, dans l’ordre de navigation :",
    ...lines,
    "Actions possibles : ouvrir un onglet, onglet suivant ou précédent, section suivante ou précédente, accueil, catalogue, contact, devis (brouillon seulement), expliquer la page visible.",
    "N’invente ni tarif, ni délai, ni diagnostic. Ne soumets jamais un formulaire."
  ].filter(Boolean).join("\n");
}

export function buildClaireContextPrompt(knowledge) {
  return `Tu incarnes Claire, l'aidante Live Avatar et la compagne numérique du site InfoServ2A. Tu es chaleureuse, précise, professionnelle et concise. Tu parles en français naturel et tu ne te présentes jamais comme une personne physique.

Tu es une interlocutrice GÉNÉRALISTE, comme OpenAI Live. LiveAvatar est relié à OpenAI Realtime : tu peux dialoguer sur n'importe quel sujet, indépendamment du site, tout en connaissant le contexte général d'InfoServ2A et l'onglet visible.

${buildSiteBriefing(knowledge)}

Lorsque la demande est une conversation (question générale, aparté, explication sans demander d'ouvrir une page), réponds tout de suite, naturellement, en français, sans attendre un résultat d'application.

Lorsque la demande est une action de navigation (ouvrir un onglet, section suivante, devis, contact), ne parle pas tout de suite. L'application exécute d'abord l'action puis t'envoie un message commençant par [INFOSERV2A_APP_RESULT]. Reformule uniquement ce résultat en une ou deux phrases, sans mentionner le marqueur. N'ajoute aucun fait absent du résultat.

Lorsque tu reçois [INFOSERV2A_SITE_BRIEFING], mémorise le catalogue des onglets. N'y réponds pas.
Lorsque tu reçois [INFOSERV2A_PAGE_CONTEXT], mémorise la page et la section visibles. N'y réponds pas. Utilise ce contexte pour tes réponses suivantes.
Lorsque tu reçois [INFOSERV2A_USER_TEXT], c'est un message tapé par le visiteur. Réponds naturellement en tenant compte du catalogue et de l'onglet mémorisés.

L'application InfoServ2A est la seule source de vérité pour les services, coordonnées, horaires, pages et actions. L'utilisateur garde toujours accès au mode manuel. N'invente jamais un tarif, un délai, une disponibilité, une conformité, un diagnostic ou une capacité technique.`;
}

export function catalogSpeech(knowledge) {
  const titles = (knowledge.pages || []).map((page) => page.title);
  return `Le site compte ${titles.length} onglets : ${titles.join(", ")}. Je peux les parcourir un par un ou ouvrir celui que vous nommez.`;
}

export function mergeSpokenTranscript(previous, next) {
  const value = String(next || "").trim();
  const prior = String(previous || "").trim();
  if (!value) return prior;
  if (!prior) return value;
  const lowerPrev = prior.toLocaleLowerCase("fr");
  const lowerVal = value.toLocaleLowerCase("fr");
  if (lowerVal.startsWith(lowerPrev) || lowerPrev.startsWith(lowerVal)) {
    return value.length >= prior.length ? value : prior;
  }
  return `${prior} ${value}`.replace(/\s+/g, " ").trim();
}

export function currentPage(knowledge, pathname = "/") {
  const clean = pathname.split("?")[0].split("#")[0].replace(/^\//, "") || "index.html";
  return (knowledge.pages || []).find((page) => {
    const candidates = [page.href, ...(page.aliases || [])]
      .map((item) => String(item).split("#")[0].replace(/^\//, "") || "index.html");
    return candidates.includes(clean);
  }) || null;
}

export function routeCommand(input, knowledge, context = {}) {
  const raw = String(input || "").trim();
  const query = normalizeText(raw);
  if (!query) {
    return {
      type: "empty",
      speech: "Dites-moi ce que vous cherchez, ou choisissez une suggestion."
    };
  }

  for (const intent of DIRECT_INTENTS) {
    if (intent.pattern.test(query)) return { id: intent.id, ...intent.response };
  }

  if (/\b(ou suis je|cette page|cet onglet|cette rubrique|page actuelle|explique cette page|explique cet onglet)\b/.test(query)) {
    const page = resolveCurrentPage(knowledge, context);
    if (page) {
      return {
        type: "answer",
        page,
        speech: `Vous êtes sur l’onglet « ${page.title} ». ${page.summary}`
      };
    }
  }

  if (isCatalogRequest(query)) {
    return {
      type: "catalog",
      action: "list_catalog",
      speech: catalogSpeech(knowledge)
    };
  }

  if (isNextTabRequest(query)) {
    return { type: "navigate", action: "next_page", speech: "J’ouvre l’onglet suivant." };
  }
  if (isPrevTabRequest(query)) {
    return { type: "navigate", action: "prev_page", speech: "J’ouvre l’onglet précédent." };
  }
  if (isNextSectionRequest(query)) {
    return { type: "navigate", action: "next_section", speech: "Je passe à la section suivante." };
  }
  if (isPrevSectionRequest(query)) {
    return { type: "navigate", action: "prev_section", speech: "Je reviens à la section précédente." };
  }
  if (isHomeTabRequest(raw)) {
    const home = pageById(knowledge, "home");
    if (home) {
      return {
        type: "navigate",
        action: "go_home",
        page: home,
        href: home.href,
        label: home.title,
        speech: home.summary
      };
    }
  }

  const ranked = (knowledge.pages || [])
    .map((page) => ({ page, score: scorePage(query, page) }));
  if (isWebSiteRequest(query) && !/\b(camera|cameras|surveillance|alarme)\b/.test(query)) {
    ranked.forEach((entry) => {
      if (entry.page.id === "web") entry.score += 24;
    });
  } else if (isIsolatedSiteRequest(query)) {
    ranked.forEach((entry) => {
      if (entry.page.id === "videosurveillance") entry.score += 24;
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (!best || best.score < 5) {
    return {
      type: "unknown",
      speech: "On peut en parler librement. Si vous voulez un onglet du site, dites par exemple vidéosurveillance, site web, dépannage, récupération de données ou devis.",
      suggestions: ["Vidéosurveillance", "Créer un site web", "Dépannage informatique", "Demander un devis"]
    };
  }

  const anchor = findAnchor(query, best.page);
  const href = `${best.page.href}${anchor?.id ? `#${anchor.id}` : ""}`;
  const result = {
    type: isExplicitNavigation(query) ? "navigate" : "suggest",
    page: best.page,
    anchor,
    href,
    confidence: best.score,
    label: anchor?.label || best.page.title,
    speech: `${best.page.summary} ${anchor ? `La section « ${anchor.label} » correspond à votre demande.` : "Je peux afficher cette rubrique."}`
  };
  return result;
}

export function pageHrefForSession(href, mode = "shared") {
  const url = new URL(href, "https://infoserv2a.pro/");
  if (mode !== "manual") url.searchParams.set("claire", mode === "guided" ? "guided" : "continue");
  return `${url.pathname.replace(/^\//, "") || "./"}${url.search}${url.hash}`;
}

export function suggestedPrompts(knowledge, pathname = "/") {
  const page = currentPage(knowledge, pathname);
  if (page?.prompts?.length) return page.prompts.slice(0, 3);
  return (knowledge.suggestions || []).slice(0, 3);
}

const CHAT_PATTERN = /\b(bonjour|bonsoir|salut|hello|coucou|merci|ca va|comment va|comment allez|qui es tu|tu es qui|tu t appelles|blague|meteo|histoire|hors sujet|parlons d autre|autre chose|et toi|bonne journee|a bientot)\b/;

export function isSiteActionIntent(input, knowledge, context = {}) {
  const route = routeCommand(input, knowledge, context);
  if (route.type === "navigate" || route.type === "action" || route.type === "catalog") return true;
  if (isIsolatedSiteRequest(input) || isWebSiteRequest(input)) return true;
  if (isQuoteAction(input) || isContactAction(input)) return true;
  return false;
}

export function classifyUtterance(input, knowledge, context = {}) {
  const route = routeCommand(input, knowledge, context);

  if (route.type === "manual" || route.type === "recall") return { kind: "control", route };
  if (route.type === "empty") return { kind: "chat", route };
  if (route.type === "answer") return { kind: "page", route };
  if (route.type === "catalog" || route.type === "action" || route.type === "navigate") {
    return { kind: "site", route };
  }

  if (CHAT_PATTERN.test(normalizeText(input))) return { kind: "chat", route };
  if (isIsolatedSiteRequest(input) || isWebSiteRequest(input) || isQuoteAction(input) || isContactAction(input)) {
    return { kind: "site", route };
  }

  return { kind: "chat", route };
}

export function describePageContext(snapshot = {}) {
  const page = snapshot.page;
  if (!page) return "";
  const section = snapshot.section;
  return [
    `Onglet visible : ${page.title}.`,
    page.summary,
    section ? `Section visible : ${section.label}. ${section.response || ""}` : ""
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
