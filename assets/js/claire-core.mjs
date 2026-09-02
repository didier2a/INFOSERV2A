const FRENCH_STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle",
  "en", "et", "est", "je", "la", "le", "les", "ma", "mes", "mon", "nous",
  "ou", "par", "pas", "pour", "que", "qui", "sur", "tu", "un", "une", "vous"
]);

const SUBMIT_QUOTE_PATTERN = /\b(envoie|envoi|transmet(?:s|tre)?|soumet(?:s|tre)?|valide|confirme)\b.{0,48}\b(devis|demande de devis)\b|\bdevis\b.{0,24}\b(envoie|envoi|transmis|soumis)\b/;
const CALL_PATTERN = /\b(appelez|appelle|appeler|un appel|je t appelle|nous appeler|rappelez|rappeler|lancer un appel|passe(?:r)? (?:un )?appel)\b/;
const EMAIL_PATTERN = /\b((?:envoie(?:r)?|ecris|ecrire|ouvre|ouvrir|compose(?:r)?) (?:un )?(?:e-?mail|courriel|mail)|envoyer un message|(?:par|un) e-?mail|adresse (?:e-?mail|mail))\b/;

const DIRECT_INTENTS = [
  {
    id: "manual",
    pattern: /\b(mode manuel|navigation manuelle|naviguer manuellement|sans claire|ferme(?:r)? claire|ranger claire|continuer sans claire)\b/,
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
    id: "submit_quote",
    pattern: SUBMIT_QUOTE_PATTERN,
    response: {
      type: "action",
      action: "submit_quote",
      speech: "Je transmets la demande de devis vers InfoServ2A."
    }
  },
  {
    id: "call",
    pattern: CALL_PATTERN,
    response: {
      type: "action",
      action: "call",
      href: "tel:+33745156076",
      label: "Appeler le 07 45 15 60 76",
      speech: "J’ouvre l’appel vers InfoServ2A, au 07 45 15 60 76."
    }
  },
  {
    id: "email",
    pattern: EMAIL_PATTERN,
    response: {
      type: "action",
      action: "email",
      href: "mailto:contact@infoserv2a.pro",
      label: "Écrire à contact@infoserv2a.pro",
      speech: "Je transmets votre message vers InfoServ2A."
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

export function isSubmitQuoteAction(value = "") {
  return SUBMIT_QUOTE_PATTERN.test(normalizeText(value));
}

export function isCallAction(value = "") {
  return CALL_PATTERN.test(normalizeText(value));
}

export function isEmailAction(value = "") {
  return EMAIL_PATTERN.test(normalizeText(value));
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
  "submit_quote",
  "start_call",
  "compose_email",
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
    "Tu es l’aidante professionnelle d’InfoServ2A : consultante IT ouverte, scientifique, fluide et accueillante. Tu parles le langage des métiers dès qu’ils touchent au numérique. LiveAvatar n’est que ton visage et ta voix. Le site InfoServ2A est un catalogue d’onglets que tu peux ouvrir si cela sert. Tu n’es pas une IA généraliste de salon : un loisir sans lien IT, tu recentres vers InfoServ2A et l’informatique, sans mur et sans « je ne parle que d’informatique ».",
    `Entreprise : ${knowledge.site || "InfoServ2A"}. Zone : ${identity.area || ""}. Téléphone : ${identity.phone || ""}. Horaires : ${identity.hours || ""}. Email : ${identity.email || ""}.`,
    "Catalogue des onglets, dans l’ordre de navigation :",
    ...lines,
    "Actions possibles : ouvrir un onglet, onglet suivant ou précédent, section suivante ou précédente, accueil, catalogue, contact, devis (brouillon, ou envoi réel si le visiteur le demande clairement), appeler InfoServ2A, envoyer un e-mail vers InfoServ2A, expliquer la page visible.",
    "N’invente ni tarif, ni délai, ni diagnostic. N’invente jamais une coordonnée. N’envoie un devis ou un e-mail que sur demande orale explicite. Ne dis jamais qu’un e-mail est parti tant que [INFOSERV2A_APP_RESULT] ne le confirme pas."
  ].filter(Boolean).join("\n");
}

export const CLAIRE_WELCOME = "Bonjour. Moi c’est Claire, votre aidante Live Avatar. Je suis là, avec vous, à Porto-Vecchio, chez InfoServ2A. Prenez votre temps. Qu’est-ce qui vous amène ? Je vous écoute.";

const INTERNAL_SITE_PROMPT = /\[INFOSERV2A_[A-Z0-9_]+\]/;

export function isInternalSitePrompt(text = "") {
  return INTERNAL_SITE_PROMPT.test(String(text || ""));
}

export const CLAIRE_OFF_TOPIC_SPEECH = "Je suis là pour le numérique et InfoServ2A. Un ordinateur, un site, une caméra, un devis ?";

export function buildClaireContextPrompt(knowledge) {
  return `Tu incarnes Claire, l'aidante Live Avatar d'InfoServ2A. Ta présence est celle du portrait : un visage calme, ouvert, accueillant. Tu es très à l’écoute. Tu ne précipites rien. Tu es une experte humaine, chaleureuse et précise. Tu ne te présentes jamais comme une personne physique.

Dès le début de la session, tu prononces l'accueil d'ouverture : tu te nommes, tu situes InfoServ2A à Porto-Vecchio, tu invites à parler. Une question douce suffit. Tu écoutes d’abord, tu reformules ce que tu as entendu, puis tu réponds. Tu ne te répètes pas.

Tu parles un français chaleureux, souple, un peu littéraire sans être précieux : des phrases qui respirent, un vocabulaire vivant, jamais administratif, jamais impératif. Tu n’ordonnes pas. Tu n’emploies pas de formules du type « dites-moi plutôt », « parlez-moi simplement », « restez dans l’informatique ». Tu invites, tu accompagnes.

Tu es une interlocutrice professionnelle, cultivée, scientifique dans le ton. Ton périmètre : l’informatique, les sciences et techniques du numérique, et toute activité professionnelle dès qu’elle a un rapport avec le numérique — cabinet, commerce, resto, labo, collectivité, industrie. Tu parles leur langage. LiveAvatar n’est que ton visage et ta voix.

Tu n’es ni une encyclopédie ni une copine de salon. Cuisine, sport, horoscope, voyage loisir, blague qui s’éternise : une phrase courtoise, tu ne développes pas, tu recentres vers InfoServ2A et l’IT. Jamais de formule du type « je ne parle que d’informatique » ou « restez dans l’informatique ».

Si quelqu’un tient un restaurant, tu parles Wi-Fi, caisse, site, caméras 4G, devis — pas la recette. Si c’est un médecin, RGPD, dossiers, réseau, sauvegarde — pas un avis médical. Un PC qui ne s’allume plus : diagnostic prudent, maintenance, devis, sans inventer la panne. Un audit NIS 2 : explication nette, puis l’offre InfoServ2A.

Les salutations, les remerciements et « qui es-tu » restent possibles. Le site InfoServ2A est un catalogue d'onglets que tu peux ouvrir quand cela sert vraiment la personne.

Tu termines tes phrases. Un changement de page ou de section à droite n’est pas une question : tu ne t’interromps pas, tu ne le commentes pas, tu continues ta pensée. Tu parles pendant que le site se synchronise.

Tu peux être interrompue à tout moment : si le visiteur te coupe vraiment la parole, touche ton portrait, ou appuie sur Interrompre. Un bruit, un clic dans le site, ou la synchronisation de l’onglet ne sont pas une interruption. Que l'écran soit un ordinateur ou un téléphone, reste naturelle ; sur un petit écran, sois plus brève. La navigation manuelle reste toujours disponible.

${buildSiteBriefing(knowledge)}

Lorsque la personne parle d’un métier, d’un outil numérique, d’une science liée aux données, réseaux, IA ou sécurité, réponds tout de suite, naturellement, en français, sans attendre un résultat d'application. Si c’est un loisir sans lien IT, recentre vers InfoServ2A et l’informatique.

Lorsque tu présentes un service InfoServ2A, nomme clairement un seul onglet (par exemple Vidéosurveillance, Création de sites web), puis éventuellement une section, pour que la page de droite s’ouvre toute seule. Tu n’as pas à commenter ce changement. Ne récite pas tous les onglets d'un seul trait si tu veux les montrer.

Si tu reçois [INFOSERV2A_APP_RESULT], reformule uniquement ce résultat en une ou deux phrases, sans mentionner le marqueur. N'ajoute aucun fait absent du résultat. Si tu es déjà en train de parler, tu termines d’abord ta phrase.

Lorsque tu reçois [INFOSERV2A_SITE_BRIEFING], mémorise le catalogue des onglets. N'y réponds pas.
Lorsque tu reçois [INFOSERV2A_PAGE_CONTEXT], mémorise la page et la section visibles. N'y réponds pas. Utilise ce contexte pour tes réponses suivantes.
Lorsque tu reçois [INFOSERV2A_SESSION_MEMORY], c’est le contexte déjà dit dans cet onglet de navigateur. Mémorise-le. N’y réponds pas. Ne fais pas répéter le visiteur.
Lorsque tu reçois [INFOSERV2A_USER_TEXT], c'est un message tapé par le visiteur. Réponds dans ton périmètre : IT, sciences du numérique, métiers qui s’appuient sur l’IT.
Lorsque tu reçois [INFOSERV2A_OFF_TOPIC], c’est un loisir ou un aparté sans lien numérique. Une phrase courtoise, tu ne développes pas, tu recentres vers InfoServ2A et l’IT. Jamais de phrase du type « je ne parle que d’informatique ».

Sur demande orale explicite, tu peux : préremplir un devis ; l’envoyer réellement vers devis@infoserv2a.pro seulement si le visiteur dit clairement « envoie » ou « transmets » le devis ; ouvrir un appel vers InfoServ2A ; envoyer réellement un message vers contact@infoserv2a.pro. L’adresse saisie par le visiteur est celle où InfoServ2A lui répondra, pas la destination. Tu n’envoies jamais vers une autre boîte. N’invente jamais un nom, un téléphone, un e-mail ou une commune. S’il manque un champ, demande-le à l’oral. Ne dis jamais « c’est envoyé » tant que [INFOSERV2A_APP_RESULT] ne confirme pas l’envoi. Si le résultat dit que ce n’est pas parti, dis-le clairement.

L'application InfoServ2A est la seule source de vérité pour les services, coordonnées, horaires, pages et actions. L'utilisateur garde toujours accès au mode manuel. N'invente jamais un tarif, un délai, une disponibilité, une conformité, un diagnostic matériel définitif ou une capacité technique non vérifiée.`;
}

export function catalogSpeech(knowledge) {
  const titles = (knowledge.pages || []).map((page) => page.title);
  return `Le site compte ${titles.length} onglets : ${titles.join(", ")}. Je peux les parcourir un par un ou ouvrir celui que vous nommez.`;
}

export function lastSpeechWindow(text, maxChars = 240) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(-maxChars);
  const boundary = slice.search(/[.!?…]\s+/);
  return boundary >= 0 && boundary < 80 ? slice.slice(boundary + 1).trim() : slice.trim();
}

export function followSpokenNavigation(text, knowledge, context = {}) {
  const full = String(text || "").replace(/\s+/g, " ").trim();
  if (full.length < 16) return null;
  const window = lastSpeechWindow(full);
  const windowNorm = normalizeText(window);
  const titlesHit = (knowledge.pages || []).filter((page) => {
    const title = normalizeText(page.title);
    return title.length > 5 && windowNorm.includes(title);
  });
  if (titlesHit.length >= 3) return null;

  const route = routeCommand(window, knowledge, context);
  if (!route?.page || ["unknown", "empty", "catalog", "manual", "recall", "action"].includes(route.type)) {
    return null;
  }

  const query = windowNorm;
  const titleTokens = normalizeText(route.page.title).split(" ").filter((token) => token.length > 4);
  const titleHit = titleTokens.some((token) => query.includes(token));
  const named = titleHit || titlesHit.some((page) => page.id === route.page.id);
  const cue = /\b(voici|voila|onglet|rubrique|cette page|cette section|a droite|ci-contre|je vous montre|regardons|on voit|cette offre|solutions sans fibre|audit nis|hebergement|parlons de|concernant|s agissant)\b/.test(query);
  const ranked = (knowledge.pages || [])
    .map((page) => ({ page, score: scorePage(window, page) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  const unique = Boolean(
    best?.page?.id === route.page.id
    && best.score >= 8
    && (!second || best.score - second.score >= 8)
  );
  if (!cue && !named && !unique && !isIsolatedSiteRequest(window) && !isWebSiteRequest(window)) {
    return null;
  }
  if (route.page.id === "home" && !/\baccueil\b/.test(query)) return null;

  const currentPageId = context.pageId || currentPage(knowledge, context.pathname || "/")?.id || null;
  const currentAnchor = context.sectionId || null;
  const nextAnchor = route.anchor?.id || null;
  if (route.page.id === currentPageId && nextAnchor === currentAnchor) return null;
  if (route.page.id === currentPageId && !nextAnchor) return null;

  return {
    pageId: route.page.id,
    anchorId: nextAnchor,
    href: route.href,
    page: route.page,
    anchor: route.anchor || null
  };
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

export function createSpeechFollowGate() {
  let locked = false;
  let speakGeneration = 0;
  let lockAtGeneration = 0;
  let navEpoch = 0;
  let userHref = "";
  let userFollowKey = "";

  return {
    claimUserNavigation(href, followKey = "") {
      locked = true;
      lockAtGeneration = speakGeneration;
      navEpoch += 1;
      userHref = String(href || "");
      userFollowKey = String(followKey || "");
      return { epoch: navEpoch, href: userHref, followKey: userFollowKey };
    },
    onAvatarSpeakStart() {
      speakGeneration += 1;
      const wasLocked = locked;
      if (locked && speakGeneration > lockAtGeneration) locked = false;
      return { unlocked: wasLocked && !locked, generation: speakGeneration };
    },
    allowsFollow() {
      return !locked;
    },
    userHref() {
      return userHref;
    },
    userFollowKey() {
      return userFollowKey;
    },
    epoch() {
      return navEpoch;
    },
    isStale(epoch) {
      return epoch !== navEpoch;
    }
  };
}

export const LIVEAVATAR_MAX_SESSION_MS = 300_000;
export const LIVEAVATAR_SESSION_WARNING_LEAD_MS = 45_000;

export function liveAvatarSessionWarningDelayMs(
  maxDurationMs = LIVEAVATAR_MAX_SESSION_MS,
  warningLeadMs = LIVEAVATAR_SESSION_WARNING_LEAD_MS
) {
  return Math.max(0, Number(maxDurationMs) - Number(warningLeadMs));
}

export function liveAvatarSessionPhase(elapsedMs, {
  maxDurationMs = LIVEAVATAR_MAX_SESSION_MS,
  warningLeadMs = LIVEAVATAR_SESSION_WARNING_LEAD_MS
} = {}) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (elapsed >= maxDurationMs) return "ended";
  if (elapsed >= maxDurationMs - warningLeadMs) return "warning";
  return "active";
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

  if (isContactAction(raw)) {
    const page = pageById(knowledge, "contact");
    if (page) {
      return {
        type: "navigate",
        page,
        href: page.href,
        label: page.title,
        speech: page.summary
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

const SOCIAL_PATTERN = /\b(bonjour|bonsoir|salut|hello|coucou|merci|de rien|ca va|comment va|comment allez|qui es tu|tu es qui|tu t appelles|bonne journee|a bientot|au revoir|et toi|s il te plait|s il vous plait|ok|okay|oui|non|d accord|dac|parfait|super|genial|entendu|compris|tres bien|c est bon)\b/;

const COMPUTING_PATTERN = /\b(info(?:rmatique)?|ordinateur|ordi|pc|mac|imac|macbook|windows|linux|ubuntu|debian|macos|ios|iphone|ipad|android|samsung|galaxy|logiciel|software|hardware|materiel|application|appli|programme|programmer|programmation|code|coder|script|developpe|html|css|javascript|python|php|sql|base de donnee|database|api|cloud|serveur|vps|docker|reseau|wifi|wi-fi|ethernet|fibre|box|routeur|modem|vpn|dns|nas|raid|disque|ssd|hdd|ram|processeur|cpu|gpu|imprimante|scanner|ecran|clavier|souris|webcam|camera|nvr|dvr|videosurveillance|virus|malware|ransomware|phishing|pare[- ]feu|firewall|antivirus|mot de passe|password|sauvegarde|backup|chiffrement|cryptage|piratage|faille|messagerie|e-?mail|outlook|office|excel|word|teams|smartphone|tablette|telephone|configuration|depannage|maintenance|installation|mise a jour|driver|pilote|bios|firmware|intelligence artificielle|chatgpt|openai|llm|cybersecurite|nis ?2|rgpd|azure|aws|ovh|onduleur|switch|iot|domotique|objet connecte|hebergement|site web|site internet)\b/;

const IT_SYMPTOM_PATTERN = /\b(ne marche plus|ne fonctionne pas|en panne|bug|planter|plante|erreur|ecran bleu|lent|lenteur|plus acces|hors ligne|pas de son|ecran noir|connexion|coupure)\b/;

const PROFESSIONAL_PATTERN = /\b(metier|professionnel|entreprise|cabinet|hopital|clinique|laboratoire|recherche|scientifique|science|physique|chimie|biologie|mathematique|ingenier|industrie|usine|production|logistique|finance|banque|assurance|comptable|comptabilite|juridique|avocat|notaire|sante|medical|medecin|docteur|pharmacie|education|universite|ecole|pedagogie|administration|collectivite|agriculture|architecture|energie|electronique|mecanique|qualite|norme|process|dossier client|activite|restaurant|resto|commerce|boutique|hotel|camping|garage|chantier)\b/;

const OFF_TOPIC_PATTERN = /\b(recette|gateau|patisserie|cuisine|cuisiner|gateaux|cookie|football|rugby|tennis|match de|championnat|capitale|president|politique|elections|meteo|il fait beau|blague|devinette|histoire pour|raconte[- ]moi une histoire|quelle heure|culture generale|ordonnance|regime|calorie|horoscope|astrologie|religion|voyage a|hotel a|billets d avion)\b/;

export function isSocialUtterance(input = "") {
  return SOCIAL_PATTERN.test(normalizeText(input));
}

export function isComputingTopic(input = "") {
  const query = normalizeText(input);
  return COMPUTING_PATTERN.test(query) || IT_SYMPTOM_PATTERN.test(query)
    || isIsolatedSiteRequest(input) || isWebSiteRequest(input);
}

export function isProfessionalTopic(input = "") {
  return isComputingTopic(input) || PROFESSIONAL_PATTERN.test(normalizeText(input));
}

export function isOffTopicUtterance(input = "") {
  const query = normalizeText(input);
  if (!query) return false;
  if (isProfessionalTopic(input)) return false;
  if (isSocialUtterance(input) && !OFF_TOPIC_PATTERN.test(query)) return false;
  return OFF_TOPIC_PATTERN.test(query);
}

export function isSiteActionIntent(input, knowledge, context = {}) {
  const route = routeCommand(input, knowledge, context);
  if (route.type === "navigate" || route.type === "action" || route.type === "catalog") return true;
  if (isIsolatedSiteRequest(input) || isWebSiteRequest(input)) return true;
  if (isQuoteAction(input) || isSubmitQuoteAction(input) || isContactAction(input)) return true;
  if (isCallAction(input) || isEmailAction(input)) return true;
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

  if (
    isIsolatedSiteRequest(input)
    || isWebSiteRequest(input)
    || isQuoteAction(input)
    || isSubmitQuoteAction(input)
    || isContactAction(input)
    || isCallAction(input)
    || isEmailAction(input)
  ) {
    return { kind: "site", route };
  }
  if (route.type === "suggest" && route.page) {
    const title = normalizeText(route.page.title);
    if (title.length > 5 && normalizeText(input).includes(title)) {
      return { kind: "site", route };
    }
  }
  if (isSocialUtterance(input) && !OFF_TOPIC_PATTERN.test(normalizeText(input))) {
    return { kind: "chat", route };
  }
  if (isProfessionalTopic(input) || isComputingTopic(input)) return { kind: "chat", route };
  if (isOffTopicUtterance(input)) return { kind: "offtopic", route };

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
