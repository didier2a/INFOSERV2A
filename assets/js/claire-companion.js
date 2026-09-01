import {
  currentPage,
  mergeSpokenTranscript,
  routeCommand,
  suggestedPrompts
} from "./claire-core.mjs";
import { ClaireRuntimeController } from "./claire-runtime-v2.mjs";
import {
  BrowserInfoServ2ASurface,
  InfoServ2ASiteAdapter
} from "./claire-site-runtime-adapter.mjs";
import "./contact.js";
import "./devis.js";

const STORAGE_MODE = "infoserv2a.claire.mode";
const STORAGE_SEEN = "infoserv2a.claire.seen";
const KNOWLEDGE_URL = "data/site-knowledge.json?v=20260901-aidant3";
const CAPABILITIES_URL = "data/claire-capabilities.json?v=20260901-aidant3";
const LIVEAVATAR_STATUS_TIMEOUT_MS = 12000;
const CLAIRE_WELCOME = "Bonjour et bienvenue chez InfoServ2A. Je suis Claire, votre compagne numérique et aidante Live Avatar. Je suis ici pour vous présenter l’entreprise, comprendre votre besoin et vous guider en langage naturel vers le bon service : cybersécurité, réseaux et Wi-Fi, vidéosurveillance, assistance informatique ou création de sites web. Vous pouvez me parler librement et revenir à la navigation manuelle à tout moment. Que puis-je faire pour vous ?";

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
  runtimeVersion: "2.0.0-p1",
  mode: "controlled-site",
  guardrails: {
    maxConcurrentCommands: 1,
    requireDeclaredTools: true,
    allowDirectDomFromModel: false,
    allowFormSubmission: false,
    manualModeAlwaysAvailable: true
  },
  tools: [
    { name: "search_site", required: ["query"] },
    { name: "open_service", required: ["service"] },
    { name: "scroll_to", required: ["target"] },
    { name: "open_contact", required: [] },
    { name: "prefill_quote", required: ["description"] }
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
    this.nodes = {};
    this.provider = null;
    this.providerReadyPromise = null;
    this.liveAvatarStatus = null;
    this.manifest = FALLBACK_CAPABILITIES;
    this.surface = null;
    this.siteAdapter = null;
    this.runtime = null;
    this.browserVoice = new BrowserVoiceProvider({
      onTranscript: (text, final) => this.handleTranscript(text, final),
      onStatus: (value, label) => this.setStatus(value, label)
    });
  }

  async init() {
    this.cacheNodes();
    this.bindEvents();
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

    const params = new URLSearchParams(location.search);
    const requested = params.get("claire");
    const storedMode = storageGet(STORAGE_MODE);
    const seen = storageGet(STORAGE_SEEN) === "1";

    if (requested === "1") this.setState("arrival");
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

    globalThis.InfoServClaire = {
      version: "2.0.0-p1",
      companion: this,
      runtime: this.runtime,
      adapter: this.siteAdapter,
      registerProvider: (provider) => this.registerProvider(provider),
      route: (command) => this.submit(command, "api"),
      manual: () => this.enterManualMode(),
      recall: () => this.recall(),
      guided: () => this.enterGuidedMode(),
      diagnostic: () => this.diagnostic()
    };
    globalThis.dispatchEvent(new CustomEvent("infoserv:claire-ready", { detail: globalThis.InfoServClaire }));
    this.providerReadyPromise = this.configureLiveAvatarProvider();
    return this;
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
      status: find("[data-claire-status]"),
      engineStatus: find("[data-claire-engine-status]"),
      retry: find("[data-claire-retry]"),
      live: find("[data-claire-live]"),
      video: find(".claire-avatar__video")
    };
  }

  bindEvents() {
    this.root.querySelectorAll("[data-claire-start]").forEach((button) => button.addEventListener("click", () => void this.start()));
    this.root.querySelectorAll("[data-claire-manual]").forEach((button) => button.addEventListener("click", () => this.enterManualMode()));
    this.root.querySelectorAll("[data-claire-recall]").forEach((button) => button.addEventListener("click", () => this.recall()));
    this.root.querySelectorAll("[data-claire-guided]").forEach((button) => button.addEventListener("click", () => this.enterGuidedMode()));
    this.root.querySelectorAll("[data-claire-expand]").forEach((button) => button.addEventListener("click", () => void this.openConversation()));
    this.nodes.retry?.addEventListener("click", () => void this.retryLiveAvatar());
    this.nodes.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = this.nodes.input.value.trim();
      if (!value) return;
      this.nodes.input.value = "";
      void this.submit(value, "text");
    });
    this.nodes.mic?.addEventListener("click", () => void this.toggleMicrophone());
    this.nodes.stage?.addEventListener("click", (event) => {
      if (event.target?.closest?.("button, a, input")) return;
      void this.provider?.resumeMedia?.();
    });
    this.nodes.resultLink?.addEventListener("click", () => storageSet(STORAGE_MODE, "guided"));
    document.addEventListener("click", (event) => this.handleSiteLink(event));
    globalThis.addEventListener("popstate", () => {
      if (this.state === "manual" || !this.siteAdapter) return;
      void this.navigateInternal(location.href, { historyMode: "pop", announce: false });
    });
    globalThis.addEventListener("infoserv:claire-telemetry", (event) => {
      this.showRealtimeTelemetry(event.detail);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (["arrival", "shared", "action", "guided"].includes(this.state)) this.enterManualMode();
    });
  }

  setState(next) {
    this.state = next;
    this.root.dataset.state = next;
    document.body.classList.toggle("claire-arrival-open", next === "arrival");
    document.body.classList.toggle("claire-conversation-open", next === "shared" || next === "action");
    document.body.classList.toggle("claire-is-guided", next === "guided");
    this.nodes.experience?.setAttribute("aria-hidden", ["arrival", "shared", "action", "guided"].includes(next) ? "false" : "true");
    this.nodes.experience?.setAttribute("aria-modal", ["arrival", "shared", "action"].includes(next) ? "true" : "false");
    this.nodes.experience?.setAttribute("role", next === "guided" ? "complementary" : "dialog");
    if (next === "arrival") {
      this.lastFocus = document.activeElement;
      requestAnimationFrame(() => this.root.querySelector("[data-claire-start]")?.focus());
    }
  }

  setStatus(value, label) {
    if (this.nodes.status) this.nodes.status.textContent = label;
    if (this.nodes.mic) {
      const listening = value === "listening";
      this.nodes.mic.setAttribute("aria-pressed", listening ? "true" : "false");
      this.nodes.mic.setAttribute("aria-label", listening ? "Arrêter le microphone" : "Activer le microphone");
    }
    this.nodes.micLabels?.forEach((node) => { node.textContent = value === "listening" ? "Je vous écoute" : "Parler à Claire"; });
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
    storageSet(STORAGE_SEEN, "1");
    storageSet(STORAGE_MODE, "shared");
    this.audioEnabled = true;
    this.provider?.primeAudio?.();
    this.setState("shared");
    this.setStatus("connecting", "Connexion à Claire…");
    await this.providerReadyPromise;
    const greeting = CLAIRE_WELCOME;
    if (this.provider?.connect) {
      try {
        await this.provider.connect({ microphone: true });
        this.setEngineStatus("liveavatar-realtime", "LiveAvatar · OpenAI Realtime · marin");
        this.showWelcome(greeting);
      } catch {
        this.activateLocalFallback("La connexion LiveAvatar a échoué. Le mode local reste silencieux afin de ne pas imiter la voix Realtime de Claire.");
        this.showWelcome(greeting);
      }
    } else {
      this.activateLocalFallback("LiveAvatar et OpenAI Realtime ne sont pas encore disponibles. Le mode local reste silencieux afin de ne pas imiter Claire.");
      this.showWelcome(greeting);
    }
    requestAnimationFrame(() => this.nodes.input?.focus());
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
    void this.provider?.pauseListening?.();
    storageSet(STORAGE_SEEN, "1");
    storageSet(STORAGE_MODE, "manual");
    this.setState("manual");
    this.nodes.live.textContent = "Navigation manuelle activée. Claire reste disponible dans la barre de reprise.";
    const focusTarget = this.lastFocus instanceof HTMLElement ? this.lastFocus : document.querySelector("#contenu");
    focusTarget?.focus?.({ preventScroll: true });
  }

  recall() {
    storageSet(STORAGE_MODE, "shared");
    this.audioEnabled = true;
    this.setState("shared");
    this.setStatus("ready", "Prête à vous guider");
    void this.provider?.ensureMicrophone?.();
    requestAnimationFrame(() => this.nodes.input?.focus());
  }

  async openConversation() {
    storageSet(STORAGE_MODE, "shared");
    this.audioEnabled = true;
    this.provider?.primeAudio?.();
    this.setState("shared");
    this.setStatus("connecting", "Connexion à Claire…");
    await this.providerReadyPromise;
    if (this.provider?.connect) {
      try {
        await this.provider.connect({ microphone: false });
        this.setEngineStatus("liveavatar-realtime", "LiveAvatar · OpenAI Realtime · marin");
        this.showWelcome(CLAIRE_WELCOME);
      } catch {
        this.activateLocalFallback("La connexion LiveAvatar a échoué. Le mode local reste silencieux afin de ne pas imiter la voix Realtime de Claire.");
        this.showWelcome(CLAIRE_WELCOME);
      }
    } else {
      this.activateLocalFallback("LiveAvatar et OpenAI Realtime ne sont pas encore disponibles. Le mode local reste silencieux afin de ne pas imiter Claire.");
      this.showWelcome(CLAIRE_WELCOME);
    }
    requestAnimationFrame(() => this.nodes.input?.focus());
  }

  showWelcome(text) {
    if (this.welcomeShown) return;
    this.welcomeShown = true;
    this.appendTurn("companion", text);
  }

  enterGuidedMode() {
    storageSet(STORAGE_SEEN, "1");
    storageSet(STORAGE_MODE, "guided");
    this.setState("guided");
    this.setStatus("ready", this.provider ? "Claire reste avec vous" : "Claire · mode local");
    document.querySelector("#contenu")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  async retryLiveAvatar() {
    this.provider?.primeAudio?.();
    this.setEngineStatus("checking", "Vérification LiveAvatar…");
    this.providerReadyPromise = this.configureLiveAvatarProvider();
    const ready = await this.providerReadyPromise;
    if (!ready) return;
    if (this.nodes.retry) this.nodes.retry.hidden = true;
    try {
      await this.provider.connect({ microphone: true });
    } catch {
      this.activateLocalFallback("LiveAvatar reste indisponible. Vérifiez les secrets Cloudflare puis réessayez.");
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
        onAvatarTranscript: (text) => this.appendLiveCompanion(text),
        onAvatarSpeakEnd: () => this.finalizeLiveCompanionTurn(),
        onStatus: (value, label) => this.setStatus(value, label),
        onCommand: (text) => this.submit(text, "liveavatar")
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
      const response = await fetch("/api/liveavatar-status", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) {
        this.markProviderUnavailable("Le contrôle de configuration LiveAvatar est indisponible.");
        return false;
      }
      const status = await response.json();
      this.liveAvatarStatus = status;
      if (!status.configured) {
        this.markProviderUnavailable("LiveAvatar et OpenAI Realtime doivent être configurés dans les secrets Cloudflare.");
        return false;
      }
      const { InfoServ2ALiveAvatarProvider } = await import("./claire-liveavatar-provider.js");
      this.registerProvider(new InfoServ2ALiveAvatarProvider());
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

  appendTurn(role, text, { live = false } = {}) {
    if (!this.nodes.transcript || !text) return null;
    const article = document.createElement("article");
    article.className = `claire-turn claire-turn--${role}`;
    if (live) article.dataset.live = "1";
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

  appendLiveCompanion(text) {
    const value = String(text || "").trim();
    if (!value) return;
    const last = this.nodes.transcript?.querySelector('.claire-turn--companion[data-live="1"]');
    if (last) {
      const paragraph = last.querySelector("p");
      if (paragraph) paragraph.textContent = mergeSpokenTranscript(paragraph.textContent, value);
      requestAnimationFrame(() => {
        const scroller = this.nodes.conversationScroll;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
      return;
    }
    this.appendTurn("companion", value, { live: true });
  }

  finalizeLiveCompanionTurn() {
    this.nodes.transcript?.querySelectorAll('.claire-turn--companion[data-live="1"]').forEach((node) => {
      delete node.dataset.live;
    });
  }

  async submit(command, source = "text") {
    const value = String(command || "").trim();
    if (!value) return null;
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
    const direct = routeCommand(value, this.knowledge, { pathname: location.pathname });
    if (direct.type === "recall") {
      this.recall();
      this.appendTurn("companion", direct.speech);
      this.speak(direct.speech);
      return direct;
    }

    const keepGuided = this.state === "guided";
    this.setState(keepGuided ? "guided" : "shared");
    this.appendTurn("user", value);
    try {
      const outcome = await this.runtime.run(value, { pathname: this.surface?.window?.location?.pathname || location.pathname });
      globalThis.dispatchEvent(new CustomEvent("infoserv:claire-command", {
        detail: { command: value, source, outcome }
      }));
      if (outcome.plan.mode === "manual") {
        this.appendTurn("companion", outcome.plan.response);
        this.enterManualMode();
        return outcome;
      }

      const response = outcome.plan.response || "La demande a été vérifiée par InfoServ2A.";
      this.showRuntimeResult(outcome);
      if (outcome.plan.expected?.pageId) {
        storageSet(STORAGE_MODE, "guided");
        this.setState("guided");
        this.renderSuggestions();
      }
      this.setStatus("ready", "Action vérifiée · Claire reste connectée");
      if (source !== "liveavatar") this.appendTurn("companion", response);
      this.speak(response);
      return outcome;
    } catch (error) {
      const message = "Je n’ai pas pu afficher cette information de manière sûre. La navigation manuelle reste disponible.";
      this.appendTurn("companion", message);
      this.setStatus("error", "Action interrompue sans quitter la page");
      this.nodes.live.textContent = String(error?.message || error);
      this.speak(message);
      return null;
    }
  }

  handleRuntimeEvent(event) {
    if (event.type === "plan.created" && event.payload.plan?.expected?.pageId && this.state !== "manual") {
      storageSet(STORAGE_MODE, "guided");
      this.setState("guided");
    }
    const labels = {
      interpreting: ["thinking", "J’interprète votre demande…"],
      planning: ["thinking", "Je prépare une action contrôlée…"],
      executing: ["thinking", "J’affiche la rubrique demandée…"],
      verifying: ["thinking", "Je vérifie le résultat affiché…"],
      complete: ["ready", "Action vérifiée · Claire reste connectée"],
      error: ["error", "Action interrompue sans quitter la page"],
      manual: ["ready", "Navigation manuelle activée"]
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
  }

  async navigateInternal(href, { historyMode = "push", announce = true } = {}) {
    if (!this.siteAdapter) return false;
    try {
      this.setStatus("thinking", "Navigation contrôlée en cours…");
      const snapshot = await this.siteAdapter.navigateHref(href, { historyMode });
      storageSet(STORAGE_MODE, "guided");
      this.setState("guided");
      this.renderSuggestions();
      this.setStatus("ready", "Page affichée · Claire reste connectée");
      if (announce && snapshot.page) {
        const text = `Voici « ${snapshot.page.title} ». Claire reste connectée pendant votre navigation.`;
        this.appendTurn("companion", text);
      }
      return true;
    } catch (error) {
      this.setStatus("error", "Ce lien ne peut pas être ouvert par Claire");
      this.nodes.live.textContent = String(error?.message || error);
      return false;
    }
  }

  handleSiteLink(event) {
    if (event.defaultPrevented || this.state === "manual" || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin !== location.origin || !this.siteAdapter?.pageForHref(url.href)) return;
    event.preventDefault();
    void this.navigateInternal(url.href);
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
    this.provider?.primeAudio?.();
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
    if (this.provider?.interrupt) this.provider.interrupt();
    this.browserVoice.interrupt();
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
      version: "2.0.0-p1",
      state: this.state,
      provider: this.provider?.id || "browser-native-fallback",
      liveAvatarConfigured: Boolean(this.liveAvatarStatus?.configured),
      voiceRecognition: this.browserVoice.supported(),
      speechSynthesis: Boolean(globalThis.speechSynthesis),
      knowledgeVersion: this.knowledge.version || "fallback",
      runtimeState: this.runtime?.state || null,
      persistentNavigation: Boolean(this.siteAdapter),
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
