const DEFAULT_SDK_URL = "https://unpkg.com/@heygen/liveavatar-web-sdk@0.0.18/dist/index.esm.js";
const SESSION_MEDIA_TIMEOUT_MS = 45000;
const TRACK_ATTACH_TIMEOUT_MS = 18000;
const TRACK_POLL_MS = 100;
const MAX_CONNECT_ATTEMPTS = 2;
const CONNECT_RETRY_DELAY_MS = 1200;
const TRANSCRIPT_SETTLE_MS = 450;
const TRANSCRIPT_ORPHAN_MS = 2200;
const VERIFIED_REPLY_TIMEOUT_MS = 12000;

let sdkPromise = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mediaTrackState(video) {
  const stream = video?.srcObject;
  const audio = stream?.getAudioTracks?.().some((track) => track.readyState === "live" && track.enabled) || false;
  const picture = stream?.getVideoTracks?.().some((track) => track.readyState === "live" && track.enabled) || false;
  return { audio, video: picture };
}

function validEndpoint(value) {
  if (!value) return "";
  const url = new URL(value, location.origin);
  if (url.origin !== location.origin && url.protocol !== "https:") {
    throw new TypeError("Le service LiveAvatar doit utiliser HTTPS.");
  }
  return url.href;
}

async function loadSdk(url) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = import(url).then((sdk) => {
    if (!sdk?.LiveAvatarSession) throw new Error("SDK LiveAvatar invalide");
    return sdk;
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export class InfoServ2ALiveAvatarProvider {
  constructor({
    endpoint = "/api/liveavatar-session",
    sdkUrl = DEFAULT_SDK_URL,
    fetchImpl = globalThis.fetch
  } = {}) {
    this.id = "liveavatar-realtime";
    this.endpoint = validEndpoint(endpoint);
    this.sdkUrl = sdkUrl;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.session = null;
    this.sdk = null;
    this.video = null;
    this.connected = false;
    this.listening = false;
    this.startPromise = null;
    this.streamReady = false;
    this.mediaAudible = false;
    this.pendingSpeech = [];
    this.transportState = "idle";
    this.timeline = [];
    this.realtimeSignal = "idle";
    this.replyTimer = null;
    this.transcriptTimer = null;
    this.transcriptParts = [];
    this.commandInFlight = false;
    this.userSpeakComplete = false;
    this.userSpeaking = false;
    this.avatarSpeaking = false;
    this.stopping = false;
    this.connectionAttempt = 0;
    this.callbacks = {};
  }

  install({ video, onTranscript, onAvatarTranscript, onAvatarSpeakStart, onAvatarSpeakEnd, onBargeIn, onStatus, onCommand, classifyCommand } = {}) {
    this.video = video || null;
    this.prepareVideoElement();
    this.callbacks = { onTranscript, onAvatarTranscript, onAvatarSpeakStart, onAvatarSpeakEnd, onBargeIn, onStatus, onCommand, classifyCommand };
    this.callbacks.onStatus?.("ready", "LiveAvatar disponible sur activation");
    return this;
  }

  prepareVideoElement() {
    if (!this.video) return false;
    this.video.playsInline = true;
    this.video.autoplay = true;
    this.video.controls = false;
    this.video.disablePictureInPicture = true;
    this.video.preload = "auto";
    this.video.setAttribute?.("playsinline", "");
    this.video.setAttribute?.("webkit-playsinline", "");
    this.video.setAttribute?.("disablepictureinpicture", "");
    this.video.setAttribute?.("disableremoteplayback", "");
    return true;
  }

  emit(value, label) {
    this.callbacks.onStatus?.(value, label);
  }

  record(event, detail = {}) {
    const entry = { at: Date.now(), event, ...detail };
    this.timeline.push(entry);
    if (this.timeline.length > 80) this.timeline.shift();
    try {
      globalThis.dispatchEvent?.(new CustomEvent("infoserv:claire-telemetry", { detail: entry }));
    } catch { /* CustomEvent n'est pas disponible dans certains tests Node. */ }
    return entry;
  }

  setTransportState(state, detail = {}) {
    this.transportState = state;
    this.record(`transport:${state}`, detail);
  }

  primeAudio() {
    if (!this.video) return false;
    this.prepareVideoElement();
    this.video.muted = false;
    this.video.volume = 1;
    // Geste utilisateur (PC, Chrome Android, Safari iPhone) : déverrouille
    // l'autoplay. Sans flux, play() peut échouer ; on retentera à l'attache.
    void this.video.play().catch(() => {
      this.video.muted = true;
      void this.video.play().catch(() => {});
    });
    return true;
  }

  async unlockPlayback() {
    if (!this.video) return false;
    this.prepareVideoElement();
    try {
      this.video.muted = false;
      this.video.volume = 1;
      await this.video.play();
      return !this.video.muted;
    } catch {
      try {
        this.video.muted = true;
        await this.video.play();
        this.video.muted = false;
        this.video.volume = 1;
        await this.video.play();
        return !this.video.muted;
      } catch {
        this.video.muted = true;
        void this.video.play().catch(() => {});
        return false;
      }
    }
  }

  async resumeMedia() {
    if (!this.video) return false;
    const unlocked = await this.unlockPlayback();
    this.mediaAudible = unlocked && this.hasLiveAudio();
    if (!this.mediaAudible) {
      this.emit("sound", "Touchez Claire pour activer le son");
      return false;
    }
    this.emit("ready", "Son Realtime activé");
    this.flushPendingSpeech();
    return true;
  }

  async preflightMicrophone() {
    const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(
      globalThis.navigator.mediaDevices
    );
    if (!getUserMedia) {
      this.record("microphone:preflight-unavailable");
      return false;
    }
    try {
      const stream = await getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch { /* Piste déjà relâchée pour le SDK. */ }
      });
      this.record("microphone:preflight-granted");
      return true;
    } catch (error) {
      this.record("microphone:preflight-denied", { name: String(error?.name || "") });
      throw error;
    }
  }

  hasLiveAudio() {
    return mediaTrackState(this.video).audio;
  }

  hasLiveVideo() {
    return mediaTrackState(this.video).video;
  }

  async waitForMediaTracks(timeoutMs = TRACK_ATTACH_TIMEOUT_MS) {
    const startedAt = Date.now();
    let last = mediaTrackState(this.video);
    this.record("media:attach-wait", last);

    while (Date.now() - startedAt < timeoutMs) {
      last = mediaTrackState(this.video);
      if (last.audio && last.video) {
        this.record("media:tracks-live", { ...last, waitMs: Date.now() - startedAt });
        const stream = this.video?.srcObject;
        stream?.getTracks?.().forEach((track) => {
          track.addEventListener?.("ended", () => {
            this.streamReady = false;
            this.setTransportState("track-ended", { kind: track.kind });
            this.emit("error", `Piste ${track.kind === "audio" ? "audio" : "vidéo"} interrompue`);
          }, { once: true });
        });
        return true;
      }
      await delay(TRACK_POLL_MS);
    }

    this.record("media:attach-timeout", { ...last, waitMs: Date.now() - startedAt });
    throw new Error(`Pistes LiveAvatar incomplètes (audio=${last.audio}, vidéo=${last.video}).`);
  }

  sendPrompt(value) {
    if (!this.session) return false;
    const prompt = `[INFOSERV2A_APP_RESULT]\nInformation vérifiée par le site : ${value}\nRéponds en français naturel, brièvement, sans ajouter de fait ni prétendre avoir réalisé une autre action.`;
    this.record("conversation:verified-result-sent", { characters: String(value).length });
    this.session.message(prompt);
    this.armReplyTimer();
    this.emit("thinking", "Claire prépare sa réponse…");
    return true;
  }

  sendBriefing(value) {
    if (!this.session) return false;
    const prompt = `[INFOSERV2A_SITE_BRIEFING]\n${value}\nN’y réponds pas. Mémorise le catalogue des onglets. Tu restes généraliste, comme OpenAI Live.`;
    this.record("conversation:site-briefing-sent", { characters: String(value).length });
    this.session.message(prompt);
    return true;
  }

  sendContext(value) {
    if (!this.session) return false;
    const prompt = `[INFOSERV2A_PAGE_CONTEXT]\n${value}\nN’y réponds pas. Mémorise seulement l’onglet et la section visibles.`;
    this.record("conversation:page-context-sent", { characters: String(value).length });
    this.session.message(prompt);
    return true;
  }

  sendUserMessage(value) {
    const text = String(value || "").trim();
    if (!this.session || !text) return false;
    const prompt = `[INFOSERV2A_USER_TEXT]\n${text}\nRéponds naturellement, en tenant compte du catalogue InfoServ2A et de l’onglet visible.`;
    this.record("conversation:user-text-sent", { characters: text.length });
    this.session.message(prompt);
    this.armReplyTimer();
    this.emit("listening", "Claire vous répond…");
    return true;
  }

  flushPendingSpeech() {
    if (!this.mediaAudible || !this.session || !this.pendingSpeech.length) return;
    const pending = this.pendingSpeech.splice(0);
    pending.forEach((value) => this.sendPrompt(value));
  }

  clearReplyTimer() {
    clearTimeout(this.replyTimer);
    this.replyTimer = null;
  }

  armReplyTimer() {
    this.clearReplyTimer();
    this.replyTimer = setTimeout(() => {
      if (this.realtimeSignal === "reply-started") return;
      this.realtimeSignal = "reply-timeout";
      this.emit("error", "Le site a répondu, mais Claire n’a pas encore pu le dire à voix haute");
    }, VERIFIED_REPLY_TIMEOUT_MS);
  }

  cancelUnauthorizedReply(reason = "user-command") {
    return this.bargeIn(reason);
  }

  bargeIn(reason = "user-barge-in") {
    const wasSpeaking = this.avatarSpeaking;
    this.record("conversation:barge-in", { reason, avatarSpeaking: wasSpeaking });
    try { this.session?.interrupt(); } catch { /* Aucune réponse Realtime à couper. */ }
    this.clearReplyTimer();
    this.pendingSpeech = [];
    this.avatarSpeaking = false;
    try { this.session?.startListening(); } catch { /* Le SDK peut déjà écouter. */ }
    this.listening = true;
    this.callbacks.onBargeIn?.({ reason, wasSpeaking });
    this.emit("listening", "Je vous écoute");
    return true;
  }

  clearTranscriptBuffer() {
    clearTimeout(this.transcriptTimer);
    this.transcriptTimer = null;
    this.transcriptParts = [];
    this.userSpeakComplete = false;
  }

  scheduleTranscriptFlush() {
    clearTimeout(this.transcriptTimer);
    this.realtimeSignal = "buffering-transcript";
    this.emit("listening", this.userSpeakComplete ? "Je prépare l’action sur le site…" : "Phrase en cours…");
    const wait = this.userSpeakComplete ? TRANSCRIPT_SETTLE_MS : TRANSCRIPT_ORPHAN_MS;
    this.transcriptTimer = setTimeout(
      () => void this.flushTranscript({ allowIncomplete: !this.userSpeakComplete }),
      wait
    );
  }

  stageTranscript(value) {
    const text = String(value || "").trim();
    if (!text) return;

    const previous = this.transcriptParts.at(-1) || "";
    if (previous === text) return;
    if (previous && text.toLocaleLowerCase("fr").startsWith(previous.toLocaleLowerCase("fr"))) {
      this.transcriptParts[this.transcriptParts.length - 1] = text;
    } else if (!previous.toLocaleLowerCase("fr").endsWith(text.toLocaleLowerCase("fr"))) {
      this.transcriptParts.push(text);
    }

    this.scheduleTranscriptFlush();
  }

  async flushTranscript({ allowIncomplete = false } = {}) {
    clearTimeout(this.transcriptTimer);
    this.transcriptTimer = null;
    if (this.commandInFlight) return;
    const text = this.transcriptParts.join(" ").replace(/\s+/g, " ").trim();
    const significant = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "");
    if (significant.length < 4) {
      this.realtimeSignal = "waiting-complete-phrase";
      this.emit("listening", "Continuez votre phrase…");
      return;
    }
    if (!this.userSpeakComplete && !allowIncomplete) {
      this.realtimeSignal = "waiting-end-of-speech";
      this.emit("listening", "J’attends la fin de votre phrase…");
      return;
    }

    this.transcriptParts = [];
    this.commandInFlight = true;
    this.realtimeSignal = "transcribed";
    try {
      let kind = "chat";
      if (typeof this.callbacks.classifyCommand === "function") {
        kind = (await this.callbacks.classifyCommand(text)) || "chat";
      }
      if (kind !== "chat") {
        this.realtimeSignal = "sync-site";
        this.emit("thinking", "Je synchronise la page de droite…");
      } else {
        this.realtimeSignal = "natural-reply";
        this.emit("listening", "Claire vous répond…");
      }
      await this.callbacks.onCommand?.(text);
    } finally {
      this.commandInFlight = false;
      if (this.transcriptParts.length) this.scheduleTranscriptFlush();
    }
  }

  async connect({ microphone = false } = {}) {
    if (this.connected && this.streamReady) {
      if (microphone) await this.ensureMicrophone();
      return true;
    }
    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      this.emit("connecting", "Connexion sécurisée à Claire…");
      let lastError;
      for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt += 1) {
        this.connectionAttempt = attempt;
        this.setTransportState("token-request", { attempt });
        try {
          const [sdk, response] = await Promise.all([
            loadSdk(this.sdkUrl),
            this.fetchImpl(this.endpoint, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appId: "infoserv2a", knowledgeVersion: "1.0.0" })
            })
          ]);
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || `LiveAvatar HTTP ${response.status}`);
          if (!payload.sessionToken) throw new Error("Jeton de session LiveAvatar absent");
          this.record("transport:token-ready", { attempt, sessionId: String(payload.sessionId || "") });

          this.sdk = sdk;
          const session = new sdk.LiveAvatarSession(payload.sessionToken, { apiUrl: "https://api.liveavatar.com" });
          this.session = session;
          const streamReady = this.wireSession(session, sdk);
          let sessionTimer;
          try {
            this.setTransportState("joining", { attempt });
            await Promise.race([
              (async () => {
                await session.start();
                this.record("transport:session-started", { attempt });
                await streamReady;
              })(),
              new Promise((_, reject) => {
                sessionTimer = setTimeout(() => {
                  reject(new Error("La connexion vidéo LiveAvatar a dépassé le délai prévu."));
                }, SESSION_MEDIA_TIMEOUT_MS);
              })
            ]);
          } finally {
            clearTimeout(sessionTimer);
          }

          this.connected = true;
          this.setTransportState("connected", { attempt });
          if (microphone) await this.ensureMicrophone();
          else this.emit("ready", "Claire est connectée");
          return true;
        } catch (error) {
          lastError = error;
          this.record("transport:attempt-failed", {
            attempt,
            message: String(error?.message || error).slice(0, 180)
          });
          await this.disposeSession(this.session);
          if (attempt < MAX_CONNECT_ATTEMPTS) {
            this.setTransportState("retry-wait", { attempt });
            this.emit("connecting", "Transport interrompu · nouvelle tentative…");
            await delay(CONNECT_RETRY_DELAY_MS);
          }
        }
      }

      this.setTransportState("failed", { attempts: MAX_CONNECT_ATTEMPTS });
      this.emit("error", "LiveAvatar indisponible · transport interrompu");
      throw lastError || new Error("Connexion LiveAvatar interrompue");
    })();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
      this.connectionAttempt = 0;
    }
  }

  wireSession(session, sdk) {
    const { SessionEvent, AgentEventsEnum } = sdk;
    let settled = false;
    let resolveStream;
    let rejectStream;
    const streamReady = new Promise((resolve, reject) => {
      resolveStream = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      rejectStream = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
    });
    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      void (async () => {
        if (!this.video) throw new Error("Élément vidéo Claire absent");
        this.record("transport:stream-ready-event");
        this.video.hidden = false;
        // Le SDK officiel attache les pistes vidéo ET audio au même média.
        // On conserve donc ce média audible au lieu de détourner sa piste
        // vers un AudioContext parfois suspendu par Chrome Android / iOS.
        this.prepareVideoElement();
        await Promise.resolve(session.attach(this.video));
        await this.waitForMediaTracks();
        this.streamReady = true;
        resolveStream(true);
        const unlocked = await this.unlockPlayback();
        this.mediaAudible = unlocked && this.hasLiveAudio();
        if (this.mediaAudible) {
          this.emit("ready", "Claire · LiveAvatar Realtime · son actif");
          this.flushPendingSpeech();
        } else {
          this.emit("sound", "Touchez Claire pour activer le son");
        }
      })().catch((error) => rejectStream(error));
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, () => {
      if (this.session !== session) return;
      rejectStream(new Error("La session LiveAvatar a été interrompue avant l’arrivée du flux vidéo."));
      this.connected = false;
      this.streamReady = false;
      this.listening = false;
      this.setTransportState(this.stopping ? "closed" : "disconnected");
      if (!this.stopping) this.emit("error", "Session LiveAvatar interrompue · touchez le micro pour reconnecter");
    });
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
      this.listening = true;
      this.userSpeaking = true;
      this.userSpeakComplete = false;
      this.realtimeSignal = "input-detected";
      this.record("conversation:user-speak-started", { avatarSpeaking: this.avatarSpeaking });
      this.clearReplyTimer();
      if (this.avatarSpeaking) this.bargeIn("user-barge-in");
      this.emit("listening", "Je vous écoute");
    });
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
      this.userSpeaking = false;
      this.userSpeakComplete = true;
      this.realtimeSignal = "input-ended";
      this.record("conversation:user-speak-ended");
      this.emit("thinking", "Un instant…");
      if (this.transcriptParts.length) this.scheduleTranscriptFlush();
    });
    session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
      const text = String(event?.text || "").trim();
      if (!text) return;
      this.record("conversation:user-transcription", { characters: text.length });
      this.clearReplyTimer();
      if (this.avatarSpeaking) this.bargeIn("user-barge-in");
      this.stageTranscript(text);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      this.avatarSpeaking = true;
      this.realtimeSignal = "reply-started";
      this.record("conversation:avatar-speak-started");
      this.clearReplyTimer();
      this.callbacks.onAvatarSpeakStart?.();
      this.emit(this.mediaAudible ? "speaking" : "sound", this.mediaAudible ? "Parlez ou touchez pour m’interrompre" : "Touchez Claire pour entendre sa réponse");
    });
    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
      const text = String(event?.text || "").trim();
      if (text) this.callbacks.onAvatarTranscript?.(text);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      this.avatarSpeaking = false;
      this.realtimeSignal = "reply-ended";
      this.record("conversation:avatar-speak-ended");
      this.clearReplyTimer();
      this.callbacks.onAvatarSpeakEnd?.();
      this.emit(this.listening ? "listening" : "ready", this.listening ? "Je vous écoute" : "Prête à vous guider");
    });
    session.on(AgentEventsEnum.SESSION_STOPPED, () => {
      this.realtimeSignal = "connector-stopped";
      this.record("conversation:connector-stopped");
      this.clearReplyTimer();
      if (!this.stopping) this.emit("error", "Le connecteur OpenAI Realtime a arrêté la session");
    });
    return streamReady;
  }

  async disposeSession(session) {
    if (!session) return;
    const current = this.session === session;
    this.stopping = true;
    try { await session.stop?.(); } catch { /* Session déjà terminée. */ }
    try { await session.room?.disconnect?.(); } catch { /* Transport LiveKit déjà fermé. */ }
    if (current) {
      this.session = null;
      this.connected = false;
      this.streamReady = false;
      this.listening = false;
      this.mediaAudible = false;
      if (this.video) {
        this.video.hidden = true;
        this.video.srcObject = null;
      }
    }
    this.stopping = false;
  }

  async ensureMicrophone() {
    if (!this.session || !this.connected) return false;
    const chat = this.session.voiceChat;
    if (!chat) return false;
    this.record("microphone:start-request", { state: String(chat.state || "unknown") });
    if (String(chat.state) === "INACTIVE") await chat.start({ defaultMuted: false });
    else if (chat.isMuted) await chat.unmute();
    try { this.session.startListening(); } catch { /* Le SDK peut déjà écouter. */ }
    this.listening = true;
    this.record("microphone:active");
    this.emit("listening", "Je vous écoute");
    return true;
  }

  async toggleListening() {
    if (!this.connected) {
      await this.connect({ microphone: true });
      return this.listening;
    }
    if (this.avatarSpeaking) {
      this.bargeIn("mic-tap");
      await this.ensureMicrophone();
      return true;
    }
    const chat = this.session?.voiceChat;
    if (!chat) return false;
    if (String(chat.state) === "INACTIVE" || chat.isMuted) return this.ensureMicrophone();
    await chat.mute();
    try { this.session.stopListening(); } catch { /* Le SDK peut déjà être en pause. */ }
    this.listening = false;
    this.record("microphone:paused", { source: "toggle" });
    this.emit("ready", "Microphone en pause");
    return false;
  }

  async pauseListening() {
    const chat = this.session?.voiceChat;
    if (chat && !chat.isMuted) {
      try { await chat.mute(); } catch { /* Le micro peut déjà être arrêté. */ }
    }
    try { this.session?.stopListening(); } catch { /* Le SDK peut déjà être en pause. */ }
    this.listening = false;
    this.clearTranscriptBuffer();
    this.record("microphone:paused", { source: "manual-mode" });
    this.emit("ready", "Microphone en pause · session Claire conservée");
    return true;
  }

  async speak(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    if (!this.connected) await this.connect({ microphone: false });
    if (!this.session) return false;
    if (!this.mediaAudible) {
      this.pendingSpeech.push(value);
      this.emit("sound", "Touchez Claire pour activer le son");
      return true;
    }
    return this.sendPrompt(value);
  }

  interrupt() {
    this.bargeIn("manual-interrupt");
  }

  async stop() {
    const session = this.session;
    await this.disposeSession(session);
    this.pendingSpeech = [];
    this.realtimeSignal = "idle";
    this.setTransportState("idle");
    this.clearReplyTimer();
    this.clearTranscriptBuffer();
    this.commandInFlight = false;
    this.userSpeakComplete = false;
    this.userSpeaking = false;
    this.avatarSpeaking = false;
  }

  diagnostic() {
    return {
      id: this.id,
      endpoint: this.endpoint,
      transportState: this.transportState,
      connectionAttempt: this.connectionAttempt,
      connected: this.connected,
      streamReady: this.streamReady,
      tracks: mediaTrackState(this.video),
      audioState: this.mediaAudible ? "audible" : (this.hasLiveAudio() ? "blocked" : "missing"),
      videoMuted: Boolean(this.video?.muted),
      realtimeSignal: this.realtimeSignal,
      commandInFlight: this.commandInFlight,
      userSpeakComplete: this.userSpeakComplete,
      userSpeaking: this.userSpeaking,
      avatarSpeaking: this.avatarSpeaking,
      listening: this.listening,
      connector: "OPENAI_REALTIME",
      transport: "ephemeral-session-token",
      timeline: this.timeline.slice(-20)
    };
  }
}
