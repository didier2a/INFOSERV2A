import {
  classifyUtterance,
  createSpeechFollowGate,
  currentPage,
  describePageContext,
  buildSiteBriefing,
  followSpokenNavigation,
  claimsUnverifiedEmailSend,
  isClaireQuotePrompt,
  isInternalSitePrompt,
  isQuoteAction,
  isSubmitQuoteAction,
  isUrgentSiteCommand,
  shouldExecuteSiteRuntime,
  liveAvatarSessionWarningDelayMs,
  grantedLiveAvatarSessionMs,
  mergeSpokenTranscript,
  suggestedPrompts,
  CLAIRE_WELCOME,
  CLAIRE_OFF_TOPIC_SPEECH,
  LIVEAVATAR_SESSION_WARNING_LEAD_MS
} from "./claire-core.mjs?v=20260905-it37";
import {
  describeQuoteChecklist,
  formatCaptionContext,
  formatMemoryBriefing,
  formatLiveMemoryCue,
  hasMemoryContent,
  loadSessionMemory,
  archiveCurrentVisit,
  hydrateQuoteMemoryFromForm,
  shouldAnnounceQuoteTruth,
  rememberPage,
  rememberTurn,
  rememberSuccessfulSend,
  beginNewQuoteAfterSend,
  quoteDraftSignature,
  contactDraftSignature,
  isSameDraftAlreadySent,
  alreadySentSpeech,
  quoteQuestionnaire,
  shouldShowQuoteQuest
} from "./claire-session-memory.mjs?v=20260905-it37";
import { describeEmailSendOutcome } from "./site-email.mjs?v=20260905-it37";
import { ClaireRuntimeController } from "./claire-runtime-v2.mjs?v=20260905-it37";
import {
  BrowserInfoServ2ASurface,
  InfoServ2ASiteAdapter
} from "./claire-site-runtime-adapter.mjs?v=20260905-it37";
import "./contact.js?v=20260905-it37";
import "./devis.js?v=20260905-it37";

const STORAGE_MODE = "infoserv2a.claire.mode";
const STORAGE_SEEN = "infoserv2a.claire.seen";
const KNOWLEDGE_URL = "data/site-knowledge.json?v=20260905-it37";
const CAPABILITIES_URL = "data/claire-capabilities.json?v=20260905-it37";
const SILENT_SYNC_DELAY_MS = 4200;
const LIVEAVATAR_STATUS_TIMEOUT_MS = 12000;
const SPEECH_FOLLOW_MS = 360;
const PREFETCH_PAGE_IDS = ["videosurveillance", "web", "quote", "contact"];
const LIVEAVATAR_CLOUD_FALLBACKS = [
  "https://infoserv2a.infoserv2a.workers.dev",
  "https://cursor-live-avatar-aidant-8f54-infoserv2a.infoserv2a.workers.dev"
];
const FALLBACK_KNOWLEDGE = {
  suggestions: ["Vidéosurveillance", "Création de site web", "Dépannage informatique"],
  pages: [
    {
      id: "home",
      href: "index.html",
      aliases: ["/", ""],
      title: "Accueil InfoServ2A",
      summary: "InfoServ2A accompagne les besoins de vidéosurveillance, de sites web et d’assistance informatique à Porto-Vecchio.",
      keywords: ["accueil", "services", "infoserv2a"]
    },
    {
      id: "contact",
      href: "contact.html",
      title: "Contact",
      summary: "La page Contact regroupe les coordonnées, les horaires et le formulaire de message.",
      keywords: ["contact", "téléphone", "email", "horaires"]
    },
    {
      id: "quote",
      href: "devis.html",
      title: "Demande de devis",
      summary: "Le devis est gratuit et sans engagement.",
      keywords: ["devis", "prix", "projet"]
    }
  ]
};

const FALLBACK_CAPABILITIES = {
  runtimeVersion: "2.3.0-memory",
  mode: "generalist-with-site-catalog",
  guardrails: {
    maxConcurrentCommands: 1,
    requireDeclaredTools: true,
    allowDirectDomFromModel: false,
    allowFormSubmission: true,
    manualModeAlwaysAvailable: true,
    defaultUtteranceKind: "chat"
  },
  tools: [
    { name: "search_site", required: ["query"] },
    { name: "open_service", required: ["service"] },
    { name: "scroll_to", required: ["target"] },
    { name: "open_contact", required: [] },
    { name: "prefill_quote", required: ["description"] },
    { name: "submit_quote", required: [] },
    { name: "start_call", required: [] },
    { name: "compose_email", required: [] },
    { name: "list_catalog", required: [] },
    { name: "explain_page", required: [] },
    { name: "go_home", required: [] },
    { name: "next_page", required: [] },
    { name: "prev_page", required: [] },
    { name: "next_section", required: [] },
    { name: "prev_section", required: [] }
  ]
};

function storageGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* Navigation reste fonctionnelle sans stockage. */ }
}

function storageRemove(key) {
  try { sessionStorage.removeItem(key); } catch { /* Rien à faire. */ }
}

function isPhoneShell() {
  try {
    return Boolean(globalThis.matchMedia?.("(max-width: 820px), ((pointer: coarse) and (hover: none))")?.matches);
  } catch {
    return false;
  }
}

function isTypingControl(node) {
  if (!(node instanceof Element)) return false;
  if (node.closest?.(".claire-companion")) {
    return Boolean(node.closest?.("[data-claire-form]") || node.matches?.("#claireCommand, textarea, input"));
  }
  const contenu = document.getElementById("contenu");
  if (!contenu?.contains(node)) return false;
  return node.matches?.(
    "input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select, [contenteditable='true']"
  );
}

function isSiteContentTarget(node) {
  if (!(node instanceof Element)) return false;
  if (node.closest?.(".claire-companion, .nav-panel, .nav-overlay, .site-header")) return false;
  return Boolean(document.getElementById("contenu")?.contains(node));
}

function liveAvatarStatusUrls() {
  return [...new Set([globalThis.location.origin, ...LIVEAVATAR_CLOUD_FALLBACKS])]
    .map((origin) => `${origin}/api/liveavatar-status`);
}

async function probeLiveAvatarStatus(signal) {
  let lastUnconfigured = null;
  for (const url of liveAvatarStatusUrls()) {
    if (signal?.aborted) break;
    try {
      const origin = new URL(url).origin;
      const response = await fetch(url, {
        cache: "no-store",
        credentials: origin === globalThis.location.origin ? "same-origin" : "omit",
        signal
      });
      if (!response.ok) continue;
      const status = await response.json();
      const probed = { origin, status };
      if (status?.configured) return probed;
      lastUnconfigured = probed;
    } catch (error) {
      if (error?.name === "AbortError") break;
    }
  }
  return lastUnconfigured;
}

function preferredFrenchVoice() {
  const voices = globalThis.speechSynthesis?.getVoices?.() || [];
  return voices.find((voice) => /^fr[-_]/i.test(voice.lang) && /natural|premium|audrey|denise|hortense/i.test(voice.name))
    || voices.find((voice) => /^fr[-_]/i.test(voice.lang))
    || null;
}

class BrowserVoiceProvider {
  constructor({ onTranscript, onStatus }) {
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.recognition = null;
    this.listening = false;
  }

  supported() {
    return Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
  }

  async toggleListening() {
    if (this.listening && this.recognition) {
      this.recognition.stop();
      return false;
    }
    const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Recognition) throw new Error("La dictée vocale n’est pas disponible dans ce navigateur.");

    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    this.recognition = recognition;

    recognition.onstart = () => {
      this.listening = true;
      this.onStatus?.("listening", "Je vous écoute");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      if (transcript) this.onTranscript?.(transcript, event.results[event.results.length - 1]?.isFinal === true);
    };
    recognition.onerror = (event) => {
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      this.onStatus?.("error", denied ? "Microphone non autorisé" : "Dictée vocale indisponible");
    };
    recognition.onend = () => {
      this.listening = false;
      this.onStatus?.("ready", "Prête à vous guider");
    };
    recognition.start();
    return true;
  }

  speak(text) {
    if (!globalThis.speechSynthesis || !text) return false;
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = "fr-FR";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    const voice = preferredFrenchVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => this.onStatus?.("speaking", "Claire vous répond");
    utterance.onend = () => this.onStatus?.("ready", "Prête à vous guider");
    globalThis.speechSynthesis.speak(utterance);
    return true;
  }

  interrupt() {
    try { this.recognition?.stop(); } catch { /* Session déjà arrêtée. */ }
    globalThis.speechSynthesis?.cancel?.();
    this.listening = false;
  }
}

export class ClaireCompanion {
  constructor(root) {
    this.root = root;
    this.debugMode = new URLSearchParams(location.search).get("debug") === "1";
    this.knowledge = FALLBACK_KNOWLEDGE;
    this.state = "loading";
    this.audioEnabled = false;
    this.lastFocus = null;
    this.pendingTranscript = "";
    this.lastVoiceCommand = "";
    this.lastVoiceCommandAt = 0;
    this.welcomeShown = false;
    this.welcomeFallbackTimer = 0;
    this.avatarSpoken = "";
    this.followTimer = 0;
    this.followInFlight = false;
    this.lastFollowKey = "";
    this.speechFollowGate = createSpeechFollowGate();
    this.lastContextSignature = "";
    this.pendingSilentSync = false;
    this.silentSyncTimer = 0;
    this.sessionStartedAt = 0;
    this.sessionWarningTimer = 0;
    this.sessionEndTimer = 0;
    this.sessionNoticeKind = "";
    this.sessionReconnectLock = null;
    this.nodes = {};
    this.provider = null;
    this.providerReadyPromise = null;
    this.liveAvatarStatus = null;
    this.liveAvatarApiOrigin = null;
    this.startLock = null;
    this.wakeLock = null;
    this.manifest = FALLBACK_CAPABILITIES;
    this.surface = null;
    this.siteAdapter = null;
    this.runtime = null;
    this.lastSiteSendOk = false;
    this.lastSiteSendAt = 0;
    this.closingQuoteAfterSend = false;
    this.lastSiteTruthSpeech = "";
    this.lastQuoteAnnounceAt = 0;
    this.pendingEmailSend = false;
    this.pendingLiveMemory = false;
    this.transcriptRestored = false;
    this.browserVoice = new BrowserVoiceProvider({
      onTranscript: (text, final) => this.handleTranscript(text, final),
      onStatus: (value, label) => this.setStatus(value, label)
    });
  }

  async init() {
    this.cacheNodes();
    this.bindEvents();
    this.setEngineStatus("checking", "Préparation de Claire…");
    this.setStatus("ready", "Appuyez pour parler");
    this.applyInitialState();
    this.exposeApi();
    globalThis.InfoServClaireBoot?.flush?.();
    this.ensureProviderReady();
    const [knowledge, manifest] = await Promise.all([
      fetch(KNOWLEDGE_URL, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Knowledge HTTP ${response.status}`)))
        .catch(() => FALLBACK_KNOWLEDGE),
      fetch(CAPABILITIES_URL, { cache: "no-store" })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Capabilities HTTP ${response.status}`)))
        .catch(() => FALLBACK_CAPABILITIES)
    ]);
    this.knowledge = knowledge;
    this.manifest = manifest;
    this.surface = new BrowserInfoServ2ASurface({ knowledge: this.knowledge });
    this.siteAdapter = new InfoServ2ASiteAdapter({
      knowledge: this.knowledge,
      manifest: this.manifest,
      surface: this.surface
    });
    this.runtime = new ClaireRuntimeController({
      knowledge: this.knowledge,
      manifest: this.manifest,
      adapter: this.siteAdapter
    });
    this.runtime.subscribe((event) => this.handleRuntimeEvent(event));
    this.root.setAttribute("aria-busy", "false");
    this.renderSuggestions();
    this.highlightRequestedSection();
    this.prefetchLikelyPages();
    this.restorePersistedConversation();
    this.exposeApi();
    globalThis.InfoServClaireBoot?.flush?.();
    return this;
  }

  applyInitialState() {
    const params = new URLSearchParams(location.search);
    const requested = params.get("claire");
    const storedMode = storageGet(STORAGE_MODE);
    const seen = storageGet(STORAGE_SEEN) === "1";

    if (requested === "1" || requested === "start") this.setState("arrival");
    else if (["guided", "continue"].includes(requested) || storedMode === "guided") this.setState("guided");
    else if (storedMode === "shared") this.setState("shared");
    else if (storedMode === "manual" || seen) this.setState("manual");
    else this.setState("arrival");

    if (["guided", "continue"].includes(requested) && history.replaceState) {
      params.delete("claire");
      const remaining = params.toString();
      const clean = `${location.pathname}${remaining ? `?${remaining}` : ""}${location.hash}`;
      history.replaceState(history.state, "", clean);
    }
  }

  exposeApi() {
    globalThis.InfoServClaire = {
      version: "2.1.0-generalist",
      companion: this,
      runtime: this.runtime,
      adapter: this.siteAdapter,
      registerProvider: (provider) => this.registerProvider(provider),
      route: (command) => this.submit(command, "api"),
      followSpeech: (text) => this.syncSiteToSpeech(text),
      interrupt: () => this.interrupt(),
      manual: () => this.enterManualMode(),
      recall: () => this.recall(),
      guided: () => this.enterGuidedMode(),
      diagnostic: () => this.diagnostic()
    };
    globalThis.dispatchEvent(new CustomEvent("infoserv:claire-ready", { detail: globalThis.InfoServClaire }));
  }

  ensureProviderReady() {
    if (!this.providerReadyPromise) {
      this.providerReadyPromise = this.configureLiveAvatarProvider();
    }
    return this.providerReadyPromise;
  }

  cacheNodes() {
    const find = (selector) => this.root.querySelector(selector);
    this.nodes = {
      experience: find(".claire-experience"),
      stage: find("[data-claire-stage]"),
      transcript: find("[data-claire-transcript]"),
      conversationScroll: find(".claire-conversation__scroll"),
      suggestions: find("[data-claire-suggestions]"),
      result: find("[data-claire-result]"),
      resultTitle: find("[data-claire-result-title]"),
      resultSummary: find("[data-claire-result-summary]"),
      resultLink: find("[data-claire-result-link]"),
      form: find("[data-claire-form]"),
      input: find("#claireCommand"),
      mic: find("[data-claire-mic]"),
      micLabels: [...this.root.querySelectorAll("[data-claire-mic-label]")],
      interrupt: find("[data-claire-interrupt]"),
      status: find("[data-claire-status]"),
      engineStatus: find("[data-claire-engine-status]"),
      retry: find("[data-claire-retry]"),
      live: find("[data-claire-live]"),
      livePrompt: find("[data-claire-live-prompt]"),
      caption: find("[data-claire-caption]"),
      captionContext: find("[data-claire-caption-context]"),
      quest: find("[data-claire-quest]"),
      video: find(".claire-avatar__video"),
      sessionNotice: find("[data-claire-session-notice]"),
      sessionNoticeCopy: find("[data-claire-session-notice-copy]"),
      sessionContinue: find("[data-claire-session-continue]"),
      sendWait: find("[data-claire-send-wait]")
    };
  }

  bindEvents() {
    this.root.querySelectorAll("[data-claire-start]").forEach((button) => button.addEventListener("click", () => void this.start()));
    this.root.querySelectorAll("[data-claire-manual]").forEach((button) => button.addEventListener("click", () => this.enterManualMode()));
    this.root.querySelectorAll("[data-claire-recall]").forEach((button) => button.addEventListener("click", () => this.recall()));
    this.root.querySelectorAll("[data-claire-guided]").forEach((button) => button.addEventListener("click", () => this.enterGuidedMode()));
    this.root.querySelectorAll("[data-claire-expand]").forEach((button) => button.addEventListener("click", () => {
      if (this.state === "guided") {
        this.toggleGuidedTranscript();
        return;
      }
      void this.openConversation();
    }));
    this.nodes.retry?.addEventListener("click", () => void this.retryLiveAvatar());
    this.nodes.sessionContinue?.addEventListener("click", () => void this.reconnectLiveAvatar());
    this.nodes.interrupt?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.interrupt();
    });
    this.nodes.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = this.nodes.input.value.trim();
      if (!value) return;
      this.nodes.input.value = "";
      void this.submit(value, "text");
    });
    this.bindResponsiveShell();
    document.addEventListener("focusin", (event) => this.handleSiteFieldFocus(event));
    document.addEventListener("focusout", () => {
      globalThis.setTimeout(() => this.syncViewportShell(), 0);
    });
    document.addEventListener("pointerdown", (event) => this.handleSiteFieldPointer(event), true);
    this.nodes.mic?.addEventListener("click", () => void this.toggleMicrophone());
    this.nodes.stage?.addEventListener("click", (event) => {
      if (event.target?.closest?.("button, a, input")) return;
      if (this.provider?.avatarSpeaking) {
        this.interrupt();
        return;
      }
      void this.provider?.resumeMedia?.();
    });
    this.nodes.resultLink?.addEventListener("click", () => storageSet(STORAGE_MODE, "guided"));
    document.addEventListener("click", (event) => this.handleSiteLink(event));
    globalThis.addEventListener("popstate", () => {
      if (this.state === "manual" || !this.siteAdapter) return;
      void this.navigateInternal(location.href, { historyMode: "pop", announce: false, silent: true });
    });
    globalThis.addEventListener("infoserv:claire-telemetry", (event) => {
      this.showRealtimeTelemetry(event.detail);
    });
    globalThis.addEventListener("infoserv:email-sending", (event) => {
      const sending = event.detail?.sending === true;
      this.root?.classList.toggle("is-email-sending", sending);
      if (this.root) this.root.dataset.emailSending = sending ? "1" : "0";
      const wait = this.nodes.sendWait;
      if (wait) wait.hidden = !sending;
      if (sending) {
        const inbox = event.detail?.inbox || "votre e-mail";
        const label = wait?.querySelector(".claire-send-wait__label");
        if (label) label.textContent = `Envoi vers ${inbox}…`;
        this.setStatus("thinking", `Envoi vers ${inbox}…`);
      }
    });
    globalThis.addEventListener("infoserv:email-sent", (event) => {
      const detail = event.detail || {};
      const kind = detail.kind === "contact" ? "contact" : "devis";
      this.closeQuoteAfterSuccessfulSend(kind, detail);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".nav-panel.is-open")) return;
      if (this.root?.dataset.transcript === "open") {
        event.preventDefault();
        this.toggleGuidedTranscript();
        return;
      }
      if (this.provider?.avatarSpeaking) {
        event.preventDefault();
        this.interrupt();
        return;
      }
      if (["arrival", "shared", "action"].includes(this.state)) {
        event.preventDefault();
        this.enterManualMode();
      }
    });
  }

  bindResponsiveShell() {
    this.syncViewportShell();
    const sync = () => this.syncViewportShell();
    globalThis.visualViewport?.addEventListener("resize", sync);
    globalThis.visualViewport?.addEventListener("scroll", sync);
    globalThis.addEventListener("resize", sync);
    globalThis.addEventListener("orientationchange", () => {
      this.syncViewportShell();
      if (this.provider?.connected) void this.provider.resumeMedia?.();
    });
    this.nodes.input?.addEventListener("focus", sync);
    this.nodes.input?.addEventListener("blur", sync);
    document.addEventListener("visibilitychange", () => void this.handleVisibility());
    globalThis.addEventListener("pageshow", (event) => {
      if (event.persisted) void this.handleVisibility();
    });
  }

  syncViewportShell() {
    const viewport = globalThis.visualViewport;
    const height = Math.round(viewport?.height || globalThis.innerHeight || 0);
    if (height) document.documentElement.style.setProperty("--claire-vvh", `${height}px`);
    document.documentElement.style.setProperty("--claire-vv-offset", `${Math.round(viewport?.offsetTop || 0)}px`);
    const phone = isPhoneShell();
    document.body.classList.toggle("claire-phone-shell", phone);
    const typing = isTypingControl(document.activeElement);
    document.body.classList.toggle("claire-keyboard-open", Boolean(phone && typing));
    if (typing && isSiteContentTarget(document.activeElement)) this.closeGuidedTranscript();
  }

  handleSiteFieldFocus(event) {
    const node = event.target;
    if (isSiteContentTarget(node) && isTypingControl(node)) this.closeGuidedTranscript();
    this.syncViewportShell();
  }

  handleSiteFieldPointer(event) {
    const node = event.target;
    if (!(node instanceof Element)) return;
    if (node.closest?.(".nav-panel, .nav-toggle, .nav-overlay")) return;
    if (!isSiteContentTarget(node)) return;
    if (isTypingControl(node) || node.closest?.("label, .form-field, input, textarea, select")) {
      this.closeGuidedTranscript();
    }
  }

  focusComposer() {
    if (isPhoneShell()) return;
    requestAnimationFrame(() => this.nodes.input?.focus());
  }

  async keepScreenAwake() {
    if (!globalThis.navigator?.wakeLock?.request) return false;
    try {
      this.wakeLock = await globalThis.navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener?.("release", () => { this.wakeLock = null; }, { once: true });
      return true;
    } catch {
      return false;
    }
  }

  releaseWakeLock() {
    try { this.wakeLock?.release?.(); } catch { /* Verrou déjà relâché. */ }
    this.wakeLock = null;
  }

  async handleVisibility() {
    this.syncViewportShell();
    if (document.visibilityState !== "visible") {
      this.releaseWakeLock();
      return;
    }
    if (!this.provider?.connected || this.state === "manual") return;
    await this.keepScreenAwake();
    await this.provider.resumeMedia?.();
    if (this.audioEnabled && this.provider.listening) {
      try { await this.provider.ensureMicrophone(); } catch { /* Session à reconnecter au micro. */ }
    }
  }

  prepareLocalVideo() {
    const video = this.nodes.video;
    if (!video) return;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
  }

  async preflightMicrophone() {
    if (this.provider?.preflightMicrophone) return this.provider.preflightMicrophone();
    const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(
      globalThis.navigator.mediaDevices
    );
    if (!getUserMedia) return false;
    const stream = await getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    stream.getTracks().forEach((track) => {
      try { track.stop(); } catch { /* Piste déjà relâchée. */ }
    });
    return true;
  }

  setState(next) {
    if (next === "guided" && this.state !== "guided") {
      this.root.dataset.transcript = "closed";
    }
    this.state = next;
    this.root.dataset.state = next;
    document.body.classList.toggle("claire-arrival-open", next === "arrival");
    document.body.classList.toggle("claire-conversation-open", next === "shared" || next === "action");
    document.body.classList.toggle("claire-is-guided", next === "guided");
    document.body.classList.toggle("claire-is-manual", next === "manual");
    this.nodes.experience?.setAttribute("aria-hidden", ["arrival", "shared", "action", "guided"].includes(next) ? "false" : "true");
    this.nodes.experience?.setAttribute("aria-modal", ["arrival", "shared", "action"].includes(next) ? "true" : "false");
    this.nodes.experience?.setAttribute("role", next === "guided" ? "complementary" : "dialog");
    if (next === "arrival") {
      this.lastFocus = document.activeElement;
      requestAnimationFrame(() => this.root.querySelector("[data-claire-start]")?.focus());
    }
    this.showLivePrompt();
    this.syncViewportShell();
  }

  setStatus(value, label) {
    if (this.nodes.status) this.nodes.status.textContent = label;
    if (this.nodes.mic) {
      const listening = value === "listening";
      this.nodes.mic.setAttribute("aria-pressed", listening ? "true" : "false");
      this.nodes.mic.setAttribute("aria-label", listening ? "Arrêter le microphone" : "Activer le microphone");
    }
    this.nodes.micLabels?.forEach((node) => { node.textContent = value === "listening" ? "Je vous écoute" : "Parler à Claire"; });
    if (this.nodes.interrupt) this.nodes.interrupt.hidden = value !== "speaking";
    if (this.nodes.stage) this.nodes.stage.dataset.presence = value;
    this.root.dataset.presence = value;
  }

  setEngineStatus(provider, label) {
    this.root.dataset.provider = provider;
    if (this.nodes.engineStatus) this.nodes.engineStatus.textContent = label;
  }

  showRealtimeTelemetry(detail = {}) {
    if (!this.debugMode || !this.nodes.live) return;
    const diagnostic = this.provider?.diagnostic?.();
    const tracks = diagnostic?.tracks || {};
    const attempt = diagnostic?.attempt || detail.attempt || 1;
    this.nodes.live.textContent = [
      "Diagnostic S22",
      String(detail.event || "initialisation"),
      `tentative ${attempt}`,
      `audio ${tracks.audio ? "OK" : "attente"}`,
      `vidéo ${tracks.video ? "OK" : "attente"}`
    ].join(" · ");
  }

  async start() {
    if (this.startLock) return this.startLock;
    this.startLock = this.connectLiveSession({ microphone: true, state: "shared" });
    try {
      return await this.startLock;
    } finally {
      this.startLock = null;
    }
  }

  async connectLiveSession({ microphone = true, state = "shared" } = {}) {
    storageSet(STORAGE_SEEN, "1");
    storageSet(STORAGE_MODE, "shared");
    this.audioEnabled = true;
    this.prepareLocalVideo();
    this.provider?.primeAudio?.();
    let microphoneRequested = microphone;
    try {
      await this.preflightMicrophone();
    } catch {
      microphoneRequested = false;
      this.setStatus("error", "Autorisez le microphone pour parler à Claire");
    }
    this.setState(state);
    this.setStatus("connecting", "Connexion à Claire…");
    this.setEngineStatus("connecting", "Connexion LiveAvatar…");
    await this.ensureProviderReady();
    const greeting = CLAIRE_WELCOME;
    if (this.provider?.connect) {
      try {
        const wasConnected = Boolean(this.provider.connected && this.provider.streamReady);
        await this.provider.connect({ microphone: microphoneRequested });
        this.setEngineStatus("liveavatar-realtime", "LiveAvatar · OpenAI Realtime · marin");
        if (!wasConnected) this.armLiveAvatarSessionWatch({ restart: true });
        this.pendingLiveMemory = hasMemoryContent(loadSessionMemory());
        this.scheduleSilentSiteSync();
        this.scheduleWelcomeTranscript(greeting);
        void this.keepScreenAwake();
      } catch {
        this.clearSessionWatch();
        this.activateLocalFallback("La connexion LiveAvatar a échoué. Le mode local reste silencieux afin de ne pas imiter la voix Realtime de Claire.");
        this.showWelcome(greeting);
      }
    } else {
      this.activateLocalFallback("LiveAvatar et OpenAI Realtime ne sont pas encore disponibles. Le mode local reste silencieux afin de ne pas imiter Claire.");
      this.showWelcome(greeting);
    }
    this.focusComposer();
  }

  activateLocalFallback(message) {
    this.provider = null;
    if (this.liveAvatarStatus?.configured) this.markProviderConnectionError(message);
    else this.markProviderUnavailable(message);
    this.appendTurn("companion", message);
  }

  markProviderConnectionError(message) {
    this.setEngineStatus("transport-error", "LiveAvatar configuré · transport interrompu");
    this.setStatus("error", "Connexion LiveAvatar interrompue · mode texte");
    if (this.nodes.retry) this.nodes.retry.hidden = false;
    if (this.nodes.live) this.nodes.live.textContent = message;
  }

  markProviderUnavailable(message) {
    this.setEngineStatus("unconfigured", "Mode local · Realtime non configuré");
    this.setStatus("error", "LiveAvatar indisponible · mode local");
    if (this.nodes.retry) this.nodes.retry.hidden = false;
    if (this.nodes.live) this.nodes.live.textContent = message;
  }

  enterManualMode() {
    this.interrupt();
    this.releaseWakeLock();
    this.hideSessionNotice();
    this.clearSessionWatch();
    void this.provider?.pauseListening?.();
    storageSet(STORAGE_SEEN, "1");
    storageSet(STORAGE_MODE, "manual");
    this.setState("manual");
    this.nodes.live.textContent = "Claire est rangée. Vous pouvez la reprendre en bas de l’écran.";
    const focusTarget = this.lastFocus instanceof HTMLElement ? this.lastFocus : document.querySelector("#contenu");
    focusTarget?.focus?.({ preventScroll: true });
  }

  recall() {
    storageSet(STORAGE_MODE, "shared");
    this.audioEnabled = true;
    this.setState("shared");
    this.setStatus("ready", "Prête à vous guider");
    void this.provider?.ensureMicrophone?.();
    this.focusComposer();
  }

  async openConversation() {
    await this.connectLiveSession({ microphone: false, state: "shared" });
  }

  toggleGuidedTranscript() {
    const open = this.root.dataset.transcript === "open";
    this.root.dataset.transcript = open ? "closed" : "open";
    this.syncExpandButtons();
  }

  closeGuidedTranscript() {
    if (this.root?.dataset.transcript !== "open") return;
    this.root.dataset.transcript = "closed";
    this.syncExpandButtons();
  }

  syncExpandButtons() {
    const open = this.root?.dataset.transcript === "open";
    this.root?.querySelectorAll("[data-claire-expand]").forEach((button) => {
      button.setAttribute("aria-expanded", open ? "true" : "false");
      if (["Conversation", "Réduire"].includes(button.textContent.trim())) {
        button.textContent = open ? "Réduire" : "Conversation";
      }
    });
  }

  showWelcome(text) {
    this.updateLiveCaption(text);
    if (this.welcomeShown) return;
    const live = this.nodes.transcript?.querySelector('.claire-turn--companion[data-live="1"]');
    if (live) {
      this.welcomeShown = true;
      return;
    }
    this.welcomeShown = true;
    this.nodes.transcript?.replaceChildren();
    this.appendTurn("companion", text);
  }

  scheduleWelcomeTranscript(text) {
    clearTimeout(this.welcomeFallbackTimer);
    this.welcomeFallbackTimer = setTimeout(() => this.showWelcome(text), 1800);
  }

  pushPageContext(snapshot = this.siteAdapter?.snapshot()) {
    const text = describePageContext(snapshot);
    if (!text) return false;
    const pathname = this.surface?.window?.location?.pathname || location.pathname;
    const signature = `${pathname}|${snapshot?.section?.id || ""}|${snapshot?.page?.id || ""}`;
    if (signature === this.lastContextSignature) return false;
    if (snapshot?.page?.title) {
      rememberPage(pathname, snapshot.page.title);
    }
    const shell = isPhoneShell()
      ? "Appareil : téléphone. Réponses plus courtes."
      : "Appareil : ordinateur.";
    this.lastContextSignature = signature;
    this.updateLiveContext();
    return this.provider?.sendContext?.(`${text}\n${shell}`) || true;
  }

  scheduleSilentSiteSync() {
    this.pendingSilentSync = true;
    clearTimeout(this.silentSyncTimer);
    this.silentSyncTimer = setTimeout(() => this.flushSilentSiteSync(), SILENT_SYNC_DELAY_MS);
  }

  flushSilentSiteSync() {
    if (!this.pendingSilentSync) return false;
    this.pendingSilentSync = false;
    clearTimeout(this.silentSyncTimer);
    this.silentSyncTimer = 0;
    if (this.forceSiteBriefing) this.provider.sendBriefing?.(buildSiteBriefing(this.knowledge));
    this.sendSessionMemory({ live: false });
    this.pushPageContext();
    this.flushPendingLiveMemory();
    return true;
  }

  sendSessionMemory({ live = false } = {}) {
    const memory = loadSessionMemory();
    if (!hasMemoryContent(memory)) return false;
    const briefing = live ? formatLiveMemoryCue(memory) : formatMemoryBriefing(memory);
    if (!briefing) return false;
    return this.provider?.sendMemory?.(briefing, { live }) || this.provider?.sendContext?.(briefing) || false;
  }

  flushPendingLiveMemory() {
    if (!this.pendingLiveMemory) return false;
    this.pendingLiveMemory = false;
    return this.sendSessionMemory({ live: true });
  }

  restorePersistedConversation() {
    if (this.transcriptRestored) return false;
    const memory = loadSessionMemory();
    if (!hasMemoryContent(memory)) return false;
    this.transcriptRestored = true;
    this.welcomeShown = true;
    for (const turn of memory.turns || []) {
      this.appendTurn(turn.role === "user" ? "user" : "companion", turn.text, { remember: false });
    }
    this.syncVisibleForms(memory);
    this.updateLiveContext();
    return true;
  }

  verifiedSpeechFor(outcome) {
    const sendSpeech = describeEmailSendOutcome(outcome);
    if (sendSpeech) return sendSpeech;
    const snapshot = this.siteAdapter?.snapshot() || {};
    const page = snapshot.page;
    const section = snapshot.section;
    const body = outcome?.plan?.response || "";
    if (!page) return body;
    const where = section
      ? `La page « ${page.title} » est affichée, section « ${section.label} ».`
      : `La page « ${page.title} » est affichée.`;
    return `${where} ${body}`.replace(/\s+/g, " ").trim();
  }

  enterGuidedMode() {
    storageSet(STORAGE_SEEN, "1");
    storageSet(STORAGE_MODE, "guided");
    this.setState("guided");
    this.setStatus("ready", this.provider ? "Claire reste avec vous" : "Claire · mode local");
  }

  async retryLiveAvatar() {
    this.prepareLocalVideo();
    this.provider?.primeAudio?.();
    try { await this.preflightMicrophone(); } catch { /* L’utilisateur pourra réessayer le micro. */ }
    this.setEngineStatus("checking", "Vérification LiveAvatar…");
    this.providerReadyPromise = this.configureLiveAvatarProvider();
    const ready = await this.providerReadyPromise;
    if (!ready) return;
    if (this.nodes.retry) this.nodes.retry.hidden = true;
    const ok = await this.reconnectLiveAvatar();
    if (!ok) {
      this.activateLocalFallback("LiveAvatar reste indisponible. Vérifiez les secrets Cloudflare puis réessayez.");
    }
  }

  grantedSessionMs() {
    return grantedLiveAvatarSessionMs(this.provider?.grantedSessionSeconds);
  }

  armLiveAvatarSessionWatch({ restart = false } = {}) {
    if (this.sessionWarningTimer && !restart) return;
    this.clearSessionWatch();
    this.sessionStartedAt = Date.now();
    const maxDurationMs = this.grantedSessionMs();
    const warningDelay = liveAvatarSessionWarningDelayMs(
      maxDurationMs,
      LIVEAVATAR_SESSION_WARNING_LEAD_MS
    );
    this.sessionWarningTimer = setTimeout(() => this.showSessionNotice("warning"), warningDelay);
    this.sessionEndTimer = setTimeout(() => this.handleLiveAvatarSessionStopped("duration-elapsed"), maxDurationMs);
  }

  clearSessionWatch() {
    clearTimeout(this.sessionWarningTimer);
    clearTimeout(this.sessionEndTimer);
    this.sessionWarningTimer = 0;
    this.sessionEndTimer = 0;
  }

  showSessionNotice(kind = "warning") {
    const notice = this.nodes.sessionNotice;
    if (!notice) return;
    this.sessionNoticeKind = kind;
    const copy = this.nodes.sessionNoticeCopy;
    const button = this.nodes.sessionContinue;
    if (kind === "warning") {
      if (copy) copy.textContent = "La présence live se termine dans moins d’une minute.";
      if (button) button.textContent = "Continuer avec Claire";
      this.setStatus("ready", "La présence live se termine bientôt");
    } else {
      if (copy) copy.textContent = "La présence live s’est arrêtée. Vous pouvez relancer Claire sans quitter cette page.";
      if (button) button.textContent = "Relancer";
      this.setStatus("ready", "Présence live arrêtée · relancez si vous voulez");
    }
    notice.hidden = false;
  }

  hideSessionNotice() {
    this.sessionNoticeKind = "";
    if (this.nodes.sessionNotice) this.nodes.sessionNotice.hidden = true;
  }

  handleLiveAvatarSessionStopped(reason = "session-stopped") {
    if (this.sessionReconnectLock) return;
    archiveCurrentVisit();
    this.clearSessionWatch();
    this.showSessionNotice("ended");
    if (this.nodes.live) {
      this.nodes.live.textContent = reason === "duration-elapsed"
        ? "La présence live s’est arrêtée. La page reste affichée."
        : "La présence live s’est arrêtée. Vous pouvez relancer Claire sans quitter cette page.";
    }
  }

  async reconnectLiveAvatar() {
    if (this.sessionReconnectLock) return this.sessionReconnectLock;
    this.sessionReconnectLock = this.performLiveAvatarReconnect();
    try {
      return await this.sessionReconnectLock;
    } finally {
      this.sessionReconnectLock = null;
    }
  }

  async performLiveAvatarReconnect() {
    const href = location.href;
    const keepGuided = this.state !== "manual" && this.state !== "arrival" && this.state !== "loading";
    this.hideSessionNotice();
    this.clearSessionWatch();
    this.prepareLocalVideo();
    this.provider?.primeAudio?.();
    try { await this.preflightMicrophone(); } catch { /* L’utilisateur pourra réessayer le micro. */ }
    this.setStatus("connecting", "Je relance la présence live…");
    this.setEngineStatus("connecting", "Reconnexion LiveAvatar…");
    try {
      if (!this.provider) {
        const ready = await this.ensureProviderReady();
        if (!ready || !this.provider) throw new Error("LiveAvatar indisponible");
      }
      if (typeof this.provider.reconnect === "function") {
        await this.provider.reconnect({ microphone: true });
      } else {
        await this.provider.stop?.();
        await this.provider.connect({ microphone: true });
      }
      this.setEngineStatus("liveavatar-realtime", "LiveAvatar · OpenAI Realtime · marin");
      this.armLiveAvatarSessionWatch({ restart: true });
      this.pendingLiveMemory = hasMemoryContent(loadSessionMemory());
      this.scheduleSilentSiteSync();
      if (keepGuided && this.state !== "manual") {
        storageSet(STORAGE_MODE, this.state === "shared" ? "shared" : "guided");
        if (this.state !== "shared") this.setState("guided");
      }
      if (location.href !== href) {
        await this.navigateInternal(href, { announce: false, silent: true, historyMode: "replace" });
      }
      this.setStatus("listening", "Claire est de nouveau avec vous");
      return true;
    } catch {
      this.showSessionNotice("ended");
      this.setStatus("error", "Je n’ai pas pu relancer la présence live");
      return false;
    }
  }

  registerProvider(provider) {
    if (!provider || typeof provider !== "object") throw new TypeError("Le fournisseur Claire doit être un objet.");
    this.provider = provider;
    if (typeof provider.install === "function") {
      provider.install({
        root: this.root,
        video: this.nodes.video,
        onTranscript: (text, final = true) => this.handleTranscript(text, final),
        onAvatarTranscript: (text) => {
          this.appendLiveCompanion(text);
          this.queueSpeechFollow(text);
        },
        onAvatarSpeakStart: () => {
          const { unlocked } = this.speechFollowGate.onAvatarSpeakStart();
          if (unlocked) this.avatarSpoken = "";
          this.showLivePrompt();
        },
        onAvatarSpeakEnd: () => {
          this.finalizeLiveCompanionTurn();
          this.updateLiveContext();
          this.flushPendingLiveMemory();
        },
        onBargeIn: () => {
          this.clearSpeechFollow({ keepLastPage: false });
          this.finalizeLiveCompanionTurn();
        },
        onStatus: (value, label) => this.setStatus(value, label),
        classifyCommand: (text) => {
          if (isUrgentSiteCommand(text)) return "site";
          return classifyUtterance(text, this.knowledge, { pathname: location.pathname }).kind;
        },
        onCommand: (text) => this.submit(text, "liveavatar"),
        onSessionStopped: (detail) => this.handleLiveAvatarSessionStopped(detail?.reason || "session-stopped")
      });
    }
    this.setEngineStatus(provider.id || "custom", "LiveAvatar · OpenAI Realtime · marin");
    return this;
  }

  async configureLiveAvatarProvider() {
    const controller = new AbortController();
    // Le premier appel au Worker peut dépasser plusieurs secondes sur mobile.
    // Ne pas activer la voix locale pendant qu'un contrôle Realtime valide est en cours.
    const timer = setTimeout(() => controller.abort(), LIVEAVATAR_STATUS_TIMEOUT_MS);
    try {
      const probed = await probeLiveAvatarStatus(controller.signal);
      if (!probed) {
        this.markProviderUnavailable("Le contrôle de configuration LiveAvatar est indisponible.");
        return false;
      }
      this.liveAvatarStatus = probed.status;
      this.liveAvatarApiOrigin = probed.origin;
      if (!probed.status.configured) {
        this.markProviderUnavailable("LiveAvatar et OpenAI Realtime doivent être configurés dans les secrets Cloudflare.");
        return false;
      }
      const { InfoServ2ALiveAvatarProvider } = await import("./claire-liveavatar-provider.js?v=20260905-it37");
      this.registerProvider(new InfoServ2ALiveAvatarProvider({
        endpoint: `${probed.origin}/api/liveavatar-session`
      }));
      return true;
    } catch {
      this.markProviderUnavailable("Impossible de vérifier LiveAvatar. Le mode local de secours est actif.");
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  renderSuggestions() {
    if (!this.nodes.suggestions) return;
    this.nodes.suggestions.replaceChildren();
    suggestedPrompts(this.knowledge, location.pathname).forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "claire-suggestion";
      button.textContent = prompt;
      button.addEventListener("click", () => void this.submit(prompt, "suggestion"));
      this.nodes.suggestions.append(button);
    });
  }

  appendTurn(role, text, { live = false, remember = true, truth = false } = {}) {
    if (!this.nodes.transcript || !text) return null;
    if (isInternalSitePrompt(text)) return null;
    if (remember && !live) {
      rememberTurn(role === "user" ? "user" : "companion", text);
      if (role === "user") this.syncVisibleForms();
    }
    const article = document.createElement("article");
    article.className = `claire-turn claire-turn--${role}`;
    if (live) article.dataset.live = "1";
    if (truth) article.dataset.siteTruth = "1";
    const label = document.createElement("span");
    label.textContent = role === "user" ? "Vous" : "Claire";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    article.append(label, paragraph);
    this.nodes.transcript.append(article);
    requestAnimationFrame(() => {
      const scroller = this.nodes.conversationScroll;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    return article;
  }

  showLivePrompt() {
    if (!this.nodes.livePrompt) return;
    if (this.state !== "guided") {
      this.nodes.livePrompt.hidden = true;
      return;
    }
    this.nodes.livePrompt.hidden = false;
    this.updateLiveContext();
  }

  updateLiveCaption(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (this.nodes.caption) this.nodes.caption.textContent = value;
    if (value) this.showLivePrompt();
    else this.updateLiveContext();
  }

  syncVisibleForms(memory = loadSessionMemory()) {
    return this.siteAdapter?.surface?.syncVisibleForms?.(memory) || { quote: false, contact: false };
  }

  updateLiveContext() {
    const snapshot = this.siteAdapter?.snapshot() || {};
    const memory = loadSessionMemory();
    const context = formatCaptionContext({
      page: snapshot.page,
      section: snapshot.section,
      memory
    });
    if (this.nodes.captionContext) this.nodes.captionContext.textContent = context;
    this.renderQuoteQuest(memory, snapshot);
  }

  renderQuoteQuest(memory, snapshot = {}) {
    const quest = this.nodes.quest;
    if (!quest) return;
    if (!shouldShowQuoteQuest(memory, snapshot.page?.id || snapshot.activePage)) {
      quest.hidden = true;
      quest.replaceChildren();
      return;
    }
    quest.hidden = false;
    quest.replaceChildren();
    quoteQuestionnaire(memory).forEach((item) => {
      const li = document.createElement("li");
      li.dataset.filled = item.value ? "1" : "0";
      li.dataset.field = item.id;
      const mark = document.createElement("b");
      mark.textContent = item.value ? "✓" : "·";
      const label = document.createElement("span");
      label.textContent = item.value ? `${item.label} : ${item.value}` : item.label;
      li.append(mark, label);
      li.addEventListener("click", () => {
        const selector = item.id === "description" ? "#devis-description" : `#devis-${item.id}`;
        document.querySelector(selector)?.focus?.();
      });
      quest.append(li);
    });
  }

  appendLiveCompanion(text) {
    const value = String(text || "").trim();
    if (!value) return;
    this.welcomeShown = true;
    clearTimeout(this.welcomeFallbackTimer);
    const last = this.nodes.transcript?.querySelector('.claire-turn--companion[data-live="1"]:not([data-site-truth="1"])');
    if (last) {
      const paragraph = last.querySelector("p");
      if (paragraph) paragraph.textContent = mergeSpokenTranscript(paragraph.textContent, value);
      this.updateLiveCaption(paragraph?.textContent || value);
      requestAnimationFrame(() => {
        const scroller = this.nodes.conversationScroll;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
      this.correctInventedSend(paragraph?.textContent || value);
      return;
    }
    const previous = this.nodes.transcript?.querySelector(".claire-turn--companion:last-of-type");
    if (previous && !previous.dataset.live && previous.dataset.siteTruth !== "1") {
      previous.dataset.live = "1";
      const paragraph = previous.querySelector("p");
      if (paragraph) paragraph.textContent = mergeSpokenTranscript(paragraph.textContent, value);
      this.updateLiveCaption(paragraph?.textContent || value);
      this.correctInventedSend(paragraph?.textContent || value);
      return;
    }
    this.appendTurn("companion", value, { live: true });
    this.updateLiveCaption(value);
    this.correctInventedSend(value);
  }

  closeQuoteAfterSuccessfulSend(kind, detail = {}) {
    if (this.closingQuoteAfterSend) return;
    this.closingQuoteAfterSend = true;
    try {
      const memory = loadSessionMemory();
      const extras = {
        name: detail.name,
        phone: detail.phone,
        email: detail.email,
        city: detail.city,
        service: detail.service,
        description: detail.description,
        message: detail.message
      };
      const signature = detail.signature
        || (kind === "contact" ? contactDraftSignature(memory, extras) : quoteDraftSignature(memory, extras));
      if (signature) {
        rememberSuccessfulSend({
          kind,
          inbox: detail.inbox || "",
          replyTo: detail.replyTo || "",
          signature
        });
      }
      beginNewQuoteAfterSend();
      this.siteAdapter?.surface?.resetQuoteNeed?.();
      this.lastSiteSendAt = Date.now();
      this.sendSessionMemory({ live: true });
      queueMicrotask(() => this.syncVisibleForms());
    } finally {
      this.closingQuoteAfterSend = false;
    }
  }

  writeSiteTruth(text, { sent = false } = {}) {
    const speech = String(text || "").trim();
    if (!speech) return { speech: "", duplicate: false };
    const duplicate = this.lastSiteTruthSpeech === speech && Boolean(this.lastSiteSendOk) === Boolean(sent);
    this.lastSiteSendOk = sent;
    if (sent) this.lastSiteSendAt = Date.now();
    this.lastSiteTruthSpeech = speech;
    if (duplicate) return { speech, duplicate: true };
    const article = this.appendTurn("companion", speech, { truth: true });
    if (article) {
      article.dataset.siteTruth = "1";
      article.dataset.sent = sent ? "1" : "0";
    }
    this.setStatus(sent ? "ready" : "error", speech);
    return { speech, duplicate: false };
  }

  announceQuoteTruth(command, source, { outcome } = {}) {
    if (isClaireQuotePrompt(command)) return "";
    const memory = hydrateQuoteMemoryFromForm();
    const pageId = this.siteAdapter?.view?.activePage || this.siteAdapter?.snapshot?.()?.page?.id || "";
    const sendSpeech = outcome ? describeEmailSendOutcome(outcome) : "";
    const wantsSend = isUrgentSiteCommand(command);
    const relevant = sendSpeech
      || wantsSend
      || isQuoteAction(command)
      || shouldAnnounceQuoteTruth(command, memory, pageId);
    if (!relevant) return "";
    const actuallySent = Boolean(outcome?.results?.some((item) => item.output?.sent));
    const checklist = describeQuoteChecklist(memory);
    const alreadySent = Boolean(checklist.alreadySent || isSameDraftAlreadySent(memory));
    if (!actuallySent && alreadySent) {
      const speech = sendSpeech || outcome?.plan?.response || alreadySentSpeech(
        memory,
        pageId === "contact" ? "contact" : "devis"
      );
      const written = this.writeSiteTruth(speech, { sent: true });
      if (written.duplicate) return "";
      this.lastQuoteAnnounceAt = Date.now();
      if (source === "liveavatar") {
        this.provider?.bargeIn?.("email-send");
        if (this.provider?.sendEmailResult) this.provider.sendEmailResult(speech);
        else this.provider?.sendPrompt?.(speech);
      } else {
        this.speak(speech);
      }
      return speech;
    }
    const speech = sendSpeech || checklist.speech;
    const now = Date.now();
    if (!actuallySent && speech === this.lastSiteTruthSpeech && now - this.lastQuoteAnnounceAt < 8000) {
      return "";
    }
    const written = this.writeSiteTruth(speech, { sent: actuallySent });
    const mustSpeak = actuallySent || (wantsSend && !written.duplicate) || !written.duplicate;
    if (!mustSpeak) return speech;
    this.lastQuoteAnnounceAt = now;
    if (source === "liveavatar") {
      this.provider?.bargeIn?.("email-send");
      if (this.provider?.sendEmailResult) this.provider.sendEmailResult(speech);
      else this.provider?.sendPrompt?.(speech);
    } else {
      this.speak(speech);
    }
    return speech;
  }

  correctInventedSend(spoken) {
    if (this.lastSiteSendOk) return;
    if (!claimsUnverifiedEmailSend(spoken)) return;
    if (Date.now() - this.lastQuoteAnnounceAt < 8000) return;
    const speech = describeQuoteChecklist(loadSessionMemory()).speech;
    this.writeSiteTruth(speech, { sent: false });
    this.provider?.bargeIn?.("email-send");
    this.provider?.sendEmailResult?.(speech);
  }

  finalizeLiveCompanionTurn() {
    this.nodes.transcript?.querySelectorAll('.claire-turn--companion[data-live="1"]').forEach((node) => {
      const spoken = node.querySelector("p")?.textContent;
      if (spoken) rememberTurn("companion", spoken);
      delete node.dataset.live;
    });
  }

  async submit(command, source = "text") {
    const value = String(command || "").trim();
    if (!value || isInternalSitePrompt(value) || isClaireQuotePrompt(value)) return null;
    hydrateQuoteMemoryFromForm();
    const classified = classifyUtterance(value, this.knowledge, { pathname: location.pathname });
    if (source === "liveavatar") {
      const signature = value.toLocaleLowerCase("fr").replace(/\s+/g, " ");
      const significant = signature.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const now = Date.now();
      if (significant.length < 4) {
        this.setStatus("listening", "Continuez votre phrase…");
        return null;
      }
      if (this.runtime?.activeCommandId || (signature === this.lastVoiceCommand && now - this.lastVoiceCommandAt < 4000)) return null;
      this.lastVoiceCommand = signature;
      this.lastVoiceCommandAt = now;
    }

    if (classified.kind === "recall" || classified.route?.type === "recall") {
      this.recall();
      this.appendTurn("companion", classified.route.speech);
      this.speak(classified.route.speech);
      return classified.route;
    }

    this.appendTurn("user", value);
    this.updateLiveContext();

    if (classified.kind === "chat" && !shouldExecuteSiteRuntime(classified, value)) {
      this.setStatus("listening", "Claire vous répond");
      if (source !== "liveavatar") this.provider?.sendUserMessage?.(value);
      await this.announceQuoteTruth(value, source);
      return { kind: "chat", classified };
    }

    if (classified.kind === "offtopic") {
      this.setStatus("listening", "Claire vous répond");
      if (source !== "liveavatar") {
        if (this.provider?.sendOffTopic) this.provider.sendOffTopic(value);
        else this.appendTurn("companion", CLAIRE_OFF_TOPIC_SPEECH);
      }
      await this.announceQuoteTruth(value, source);
      return { kind: "chat", classified };
    }

    if (classified.kind === "page") {
      const snapshot = this.siteAdapter?.snapshot() || {};
      const speech = classified.route.speech || describePageContext(snapshot);
      this.pushPageContext(snapshot);
      if (source !== "liveavatar") {
        this.appendTurn("companion", speech);
        this.speak(speech);
      }
      this.setStatus("ready", "Contexte de page partagé");
      return { kind: "page", classified };
    }

    if (classified.kind === "control" && classified.route?.type === "manual") {
      this.appendTurn("companion", classified.route.speech);
      this.enterManualMode();
      return classified.route;
    }

    if (classified.kind === "site" && classified.route?.page) {
      storageSet(STORAGE_MODE, "guided");
      this.setState("guided");
    } else {
      const keepGuided = this.state === "guided";
      this.setState(keepGuided ? "guided" : "shared");
    }

    const sendingNow = classified.route?.action === "email"
      || classified.route?.action === "submit_quote"
      || isUrgentSiteCommand(value);
    this.pendingEmailSend = sendingNow;
    if (source === "liveavatar" && sendingNow) {
      this.provider?.bargeIn?.("email-send");
    }
    if (sendingNow) {
      this.setStatus("thinking", "Envoi en cours…");
    }

    try {
      const outcome = await this.runtime.run(value, {
        pathname: this.surface?.window?.location?.pathname || location.pathname,
        pageId: this.siteAdapter?.view?.activePage,
        sectionId: this.siteAdapter?.view?.activeSection,
        memory: hydrateQuoteMemoryFromForm()
      });
      globalThis.dispatchEvent(new CustomEvent("infoserv:claire-command", {
        detail: { command: value, source, outcome }
      }));
      if (outcome.plan.mode === "manual") {
        this.appendTurn("companion", outcome.plan.response);
        this.enterManualMode();
        return outcome;
      }

      const response = this.verifiedSpeechFor(outcome);
      this.showRuntimeResult(outcome);
      if (outcome.plan.expected?.pageId) {
        storageSet(STORAGE_MODE, "guided");
        this.setState("guided");
        this.renderSuggestions();
      }
      const sentOk = Boolean(outcome.results?.some((item) => item.output?.sent));
      if (sentOk) {
        const sentResult = (outcome.results || []).find((item) => item.output?.sent);
        const kind = sentResult?.tool === "submit_quote" ? "devis" : "contact";
        this.closeQuoteAfterSuccessfulSend(kind, {
          inbox: sentResult?.output?.inbox || "",
          replyTo: sentResult?.output?.replyTo || ""
        });
      }
      this.setStatus(
        "ready",
        sentOk
          ? "Message transmis · Claire confirme à l’oral"
          : this.pendingEmailSend
            ? "Le site a répondu · rien n’est parti"
            : "Page affichée · Claire vous l’explique"
      );
      const quoteSpeech = await this.announceQuoteTruth(value, source, { outcome });
      if (source === "liveavatar") {
        this.pushPageContext();
        return outcome;
      }
      if (!quoteSpeech) {
        this.appendTurn("companion", response);
        this.speak(response);
      }
      this.pushPageContext();
      return outcome;
    } catch (error) {
      const message = "Je n’ai pas pu afficher cette information de manière sûre. La navigation manuelle reste disponible.";
      this.appendTurn("companion", message);
      this.setStatus("error", "Action interrompue sans quitter la page");
      this.nodes.live.textContent = String(error?.message || error);
      this.speak(message);
      return null;
    } finally {
      this.pendingEmailSend = false;
    }
  }

  handleRuntimeEvent(event) {
    const sending = this.pendingEmailSend;
    const labels = {
      interpreting: ["thinking", sending ? "Envoi en cours…" : "J’interprète votre demande…"],
      planning: ["thinking", sending ? "Envoi en cours…" : "Je prépare une action contrôlée…"],
      executing: ["thinking", sending ? "Envoi en cours…" : "J’affiche la rubrique demandée…"],
      verifying: ["thinking", sending ? "Le site confirme l’envoi…" : "Je vérifie le résultat affiché…"],
      complete: ["ready", sending ? "Le site a répondu · Claire confirme à l’oral" : "Page affichée · Claire vous l’explique"],
      error: ["error", "Action interrompue sans quitter la page"],
      manual: ["ready", "Claire est rangée"]
    };
    const status = labels[event.state];
    if (status) this.setStatus(status[0], status[1]);
  }

  showRuntimeResult(outcome) {
    const snapshot = this.siteAdapter.snapshot();
    if (!snapshot.page) {
      this.nodes.result.hidden = true;
      return;
    }
    const href = `${snapshot.page.href}${snapshot.section?.id ? `#${snapshot.section.id}` : ""}`;
    this.showResult({
      type: "navigate",
      page: snapshot.page,
      label: snapshot.section?.label || snapshot.page.title,
      href,
      speech: outcome.plan.response
    });
    this.syncVisibleForms();
  }

  async navigateInternal(href, { historyMode = "push", announce = true, silent = false } = {}) {
    if (!this.siteAdapter) return false;
    try {
      if (!silent) this.setStatus("thinking", "Navigation contrôlée en cours…");
      const isolateVoice = Boolean(silent || this.provider?.avatarSpeaking);
      const snapshot = await this.siteAdapter.navigateHref(href, { historyMode, scroll: !isolateVoice });
      storageSet(STORAGE_MODE, "guided");
      this.setState("guided");
      this.renderSuggestions();
      this.syncVisibleForms();
      if (isolateVoice) {
        this.pushPageContext(snapshot);
        this.setStatus(
          this.provider?.avatarSpeaking ? "speaking" : "ready",
          this.provider?.avatarSpeaking ? "Parlez ou touchez pour m’interrompre" : "Page synchronisée avec Claire"
        );
        return snapshot;
      }
      this.setStatus("ready", "Page affichée · Claire vous l’explique");
      if (announce && snapshot.page) {
        const text = this.verifiedSpeechFor({ plan: { response: snapshot.page.summary } });
        this.appendTurn("companion", text);
        this.speak(text);
        this.pushPageContext(snapshot);
      } else {
        this.pushPageContext(snapshot);
      }
      return snapshot;
    } catch (error) {
      this.setStatus("error", "Ce lien ne peut pas être ouvert par Claire");
      this.nodes.live.textContent = String(error?.message || error);
      return false;
    }
  }

  clearSpeechFollow({ keepLastPage = false } = {}) {
    clearTimeout(this.followTimer);
    this.followTimer = 0;
    this.avatarSpoken = "";
    if (!keepLastPage) this.lastFollowKey = "";
  }

  prefetchLikelyPages() {
    PREFETCH_PAGE_IDS.forEach((id) => {
      const page = this.knowledge.pages?.find((item) => item.id === id);
      if (page) this.siteAdapter?.prefetch?.(page);
    });
  }

  speechFollowContext() {
    const snapshot = this.siteAdapter?.snapshot() || {};
    return {
      pathname: this.surface?.window?.location?.pathname || location.pathname,
      pageId: snapshot.activePage || snapshot.page?.id,
      sectionId: snapshot.activeSection || snapshot.section?.id
    };
  }

  prefetchSpeechTarget() {
    const target = followSpokenNavigation(this.avatarSpoken, this.knowledge, this.speechFollowContext());
    if (target?.page) this.siteAdapter?.prefetch?.(target.page);
    return target;
  }

  queueSpeechFollow(text) {
    this.avatarSpoken = mergeSpokenTranscript(this.avatarSpoken, text);
    this.prefetchSpeechTarget();
    if (!this.speechFollowGate.allowsFollow()) return;
    clearTimeout(this.followTimer);
    this.followTimer = setTimeout(() => void this.syncSiteToSpeech(), SPEECH_FOLLOW_MS);
  }

  async syncSiteToSpeech(forcedText = "") {
    if (forcedText) this.avatarSpoken = String(forcedText);
    if (!this.speechFollowGate.allowsFollow()) return null;
    if (this.followInFlight || this.state === "manual" || this.runtime?.activeCommandId) return null;
    if (this.provider?.userSpeaking && !this.provider?.avatarSpeaking && !forcedText) return null;
    const target = followSpokenNavigation(this.avatarSpoken, this.knowledge, this.speechFollowContext());
    if (!target) return null;
    const key = `${target.pageId}#${target.anchorId || ""}`;
    if (key === this.lastFollowKey) return null;
    this.siteAdapter?.prefetch?.(target.page);
    const epoch = this.speechFollowGate.epoch();
    this.followInFlight = true;
    try {
      const href = `${target.page.href}${target.anchorId ? `#${target.anchorId}` : ""}`;
      const next = await this.navigateInternal(href, {
        historyMode: this.lastFollowKey ? "replace" : "push",
        announce: false,
        silent: true
      });
      if (this.speechFollowGate.isStale(epoch) || !this.speechFollowGate.allowsFollow()) {
        const restore = this.speechFollowGate.userHref();
        if (restore) {
          await this.navigateInternal(restore, { announce: false, silent: true, historyMode: "replace" });
          const restoreKey = this.speechFollowGate.userFollowKey();
          if (restoreKey) this.lastFollowKey = restoreKey;
        }
        return null;
      }
      if (!next) return null;
      this.lastFollowKey = key;
      return target;
    } finally {
      this.followInFlight = false;
    }
  }

  claimUserSiteNavigation(url) {
    const page = this.siteAdapter?.pageForHref(url.href);
    const hash = decodeURIComponent(String(url.hash || "").replace(/^#/, ""));
    const followKey = page ? `${page.id}#${hash || ""}` : "";
    this.speechFollowGate.claimUserNavigation(url.href, followKey);
    clearTimeout(this.followTimer);
    this.followTimer = 0;
    if (followKey) this.lastFollowKey = followKey;
  }

  handleSiteLink(event) {
    if (event.defaultPrevented || this.state === "manual" || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.closest?.(".claire-companion")) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin !== location.origin || !this.siteAdapter?.pageForHref(url.href)) return;
    event.preventDefault();
    this.closeGuidedTranscript();
    this.claimUserSiteNavigation(url);
    if (this.state !== "guided" && this.state !== "manual") this.setState("guided");
    void this.navigateInternal(url.href, { announce: false, silent: true }).then((ok) => {
      if (!ok) location.assign(url.href);
    });
  }

  showResult(result) {
    const actionable = ["suggest", "navigate", "action"].includes(result.type) && result.href;
    if (!actionable) {
      this.nodes.result.hidden = true;
      if (this.state !== "guided") this.setState("shared");
      return;
    }
    const title = result.page?.title || result.label || "Action proposée";
    this.nodes.resultTitle.textContent = title;
    this.nodes.resultSummary.textContent = result.page?.summary || result.speech;
    this.nodes.resultLink.href = result.href;
    this.nodes.resultLink.textContent = result.label || (result.type === "navigate" ? "Page affichée avec Claire" : "Afficher cette rubrique");
    this.nodes.result.hidden = false;
    this.setState(this.state === "guided" ? "guided" : "action");
  }

  async toggleMicrophone() {
    this.audioEnabled = true;
    this.prepareLocalVideo();
    this.provider?.primeAudio?.();
    try { await this.preflightMicrophone(); } catch { /* Le SDK redemandera le micro. */ }
    if (this.state === "arrival" || this.state === "loading" || !this.provider?.connected) {
      await this.start();
      return;
    }
    try {
      if (this.provider?.toggleListening) {
        try {
          const listening = await this.provider.toggleListening();
          this.setStatus(listening ? "listening" : "ready", listening ? "Je vous écoute" : "Prête à vous guider");
          return;
        } catch {
          this.activateLocalFallback("La session LiveAvatar a été interrompue. Le microphone local reste disponible.");
        }
      }
      await this.browserVoice.toggleListening();
    } catch (error) {
      const message = String(error?.message || error);
      this.setStatus("error", message);
      this.nodes.live.textContent = message;
      this.appendTurn("companion", `${message} Vous pouvez toujours écrire votre demande.`);
    }
  }

  handleTranscript(text, final) {
    if (isInternalSitePrompt(text)) return;
    this.nodes.input.value = text;
    if (!final) return;
    this.pendingTranscript = "";
    this.nodes.input.value = "";
    void this.submit(text, "voice");
  }

  speak(text) {
    if (!this.audioEnabled || !text) return false;
    if (this.provider?.speak) {
      const spoken = this.provider.speak(text);
      if (spoken && typeof spoken.catch === "function") {
        return spoken.catch(() => {
          this.activateLocalFallback("La voix OpenAI Realtime est indisponible. L’ancienne voix locale est volontairement désactivée.");
          return false;
        });
      }
      return spoken;
    }
    return false;
  }

  interrupt() {
    this.clearSpeechFollow({ keepLastPage: false });
    if (this.provider?.interrupt) this.provider.interrupt();
    this.browserVoice.interrupt();
    this.setStatus("listening", "Je vous écoute");
  }

  highlightRequestedSection() {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    target.classList.add("claire-target-highlight");
    target.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
    setTimeout(() => target.classList.remove("claire-target-highlight"), 3600);
  }

  diagnostic() {
    return {
      version: "2.1.0-generalist",
      state: this.state,
      provider: this.provider?.id || "browser-native-fallback",
      phoneShell: isPhoneShell(),
      liveAvatarConfigured: Boolean(this.liveAvatarStatus?.configured),
      grantedSessionMs: this.provider ? this.grantedSessionMs() : null,
      voiceRecognition: this.browserVoice.supported(),
      speechSynthesis: Boolean(globalThis.speechSynthesis),
      knowledgeVersion: this.knowledge.version || "fallback",
      runtimeState: this.runtime?.state || null,
      persistentNavigation: Boolean(this.siteAdapter),
      memory: (() => {
        const memory = loadSessionMemory();
        return {
          clientId: memory.clientId || "",
          visitCount: memory.visitCount || 0,
          turns: (memory.turns || []).length,
          hasContent: hasMemoryContent(memory)
        };
      })(),
      page: currentPage(this.knowledge, location.pathname)?.id || this.siteAdapter?.snapshot().activePage || null,
      realtime: this.provider?.diagnostic?.() || null
    };
  }
}

const root = document.getElementById("claireCompanion");
if (root) {
  const companion = new ClaireCompanion(root);
  void companion.init();
}
