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
  return /^(ouvre|va|allez|affiche|montre|emmene|guide|accede|lance|conduis)\b/.test(normalizeText(value));
}

export function isIsolatedSiteRequest(value = "") {
  return /\b(sans (fibre|internet|electricite|connexion|box)|pas (?:d[' ]?)?internet|pas de (fibre|connexion|box|reseau)|zone blanche|site isole)\b/.test(normalizeText(value));
}

export function isWebSiteRequest(value = "") {
  return /\b(site (web|internet|vitrine)|creer un site|refonte|hebergement)\b/.test(normalizeText(value));
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

  if (/\b(ou suis je|cette page|page actuelle|explique cette page)\b/.test(query)) {
    const page = currentPage(knowledge, context.pathname);
    if (page) {
      return {
        type: "answer",
        page,
        speech: `Vous êtes sur « ${page.title} ». ${page.summary}`
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
      speech: "Je n’ai pas trouvé de rubrique assez précise. Dites-moi par exemple vidéosurveillance, site web, dépannage, récupération de données ou devis, et j’affiche la page.",
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
