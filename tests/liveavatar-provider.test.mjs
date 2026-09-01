import assert from "node:assert/strict";
import test from "node:test";

globalThis.location = new URL("https://infoserv2a.test/");

const sdkSource = `
export const SessionEvent = {
  SESSION_STREAM_READY: "stream-ready",
  SESSION_DISCONNECTED: "disconnected"
};
export const AgentEventsEnum = {
  USER_SPEAK_STARTED: "user-speak-started",
  USER_SPEAK_ENDED: "user-speak-ended",
  USER_TRANSCRIPTION: "user-transcription",
  AVATAR_SPEAK_STARTED: "avatar-speak-started",
  AVATAR_TRANSCRIPTION: "avatar-transcription",
  AVATAR_SPEAK_ENDED: "avatar-speak-ended",
  SESSION_STOPPED: "session-stopped"
};
export class LiveAvatarSession {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
    this.voiceChat = {
      state: "INACTIVE",
      isMuted: false,
      starts: 0,
      mutes: 0,
      unmutes: 0,
      start: async () => { this.voiceChat.starts += 1; this.voiceChat.state = "ACTIVE"; },
      mute: async () => { this.voiceChat.mutes += 1; this.voiceChat.isMuted = true; },
      unmute: async () => { this.voiceChat.unmutes += 1; this.voiceChat.isMuted = false; }
    };
    this.room = { disconnect: async () => {} };
    globalThis.__infoservFakeSession = this;
  }
  on(name, callback) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(callback);
    this.listeners.set(name, listeners);
  }
  emit(name, value) {
    for (const callback of this.listeners.get(name) || []) callback(value);
  }
  async start() { setTimeout(() => this.emit("stream-ready"), 0); }
  attach(video) {
    setTimeout(() => {
      const audio = { kind: "audio", readyState: "live", enabled: true, addEventListener() {} };
      const picture = { kind: "video", readyState: "live", enabled: true, addEventListener() {} };
      video.srcObject = {
        getAudioTracks: () => [audio],
        getVideoTracks: () => [picture],
        getTracks: () => [audio, picture]
      };
    }, 40);
  }
  startListening() {}
  stopListening() {}
  message(value) { this.messages.push(value); }
  interrupt() { this.interrupted = true; }
  async stop() {}
}`;

const sdkUrl = `data:text/javascript;base64,${Buffer.from(sdkSource).toString("base64")}`;
const { InfoServ2ALiveAvatarProvider } = await import("../assets/js/claire-liveavatar-provider.js");

function fakeVideo() {
  const attrs = {};
  return {
    hidden: true,
    muted: true,
    volume: 0,
    srcObject: null,
    playsInline: false,
    autoplay: false,
    controls: false,
    disablePictureInPicture: false,
    preload: "",
    setAttribute(name, value = "") { attrs[name] = value; },
    play: async () => true
  };
}

test("le transport attend les pistes Android retardées sans arrêter la session", async () => {
  const statuses = [];
  const video = fakeVideo();
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-test" })
  }).install({
    video,
    onStatus: (state, label) => statuses.push({ state, label })
  });

  const connected = await provider.connect({ microphone: true });
  const session = globalThis.__infoservFakeSession;

  assert.equal(connected, true);
  assert.equal(provider.connected, true);
  assert.equal(provider.streamReady, true);
  assert.equal(provider.transportState, "connected");
  assert.equal(provider.hasLiveAudio(), true);
  assert.equal(provider.hasLiveVideo(), true);
  assert.equal(session.voiceChat.starts, 1);
  assert.ok(provider.diagnostic().timeline.some((entry) => entry.event === "media:tracks-live"));
  assert.ok(statuses.some((entry) => entry.label.includes("son actif")));

  session.emit("avatar-speak-started");
  session.emit("avatar-speak-ended");
  assert.equal(session.voiceChat.mutes, 0);
  assert.equal(session.voiceChat.unmutes, 0);

  await provider.stop();
});

test("une transcription stabilisée déclenche une seule action et une seule réponse vérifiée", async () => {
  const commands = [];
  const video = fakeVideo();
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-command" })
  }).install({
    video,
    classifyCommand: async () => "site",
    onCommand: async (text) => commands.push(text)
  });

  await provider.connect({ microphone: false });
  provider.stageTranscript("ouvre");
  provider.stageTranscript("ouvre la page vidéosurveillance");
  provider.userSpeakComplete = true;
  await provider.flushTranscript();
  await provider.speak("La page Vidéosurveillance est affichée.");

  const session = globalThis.__infoservFakeSession;
  assert.deepEqual(commands, ["ouvre la page vidéosurveillance"]);
  assert.equal(session.messages.length, 1);
  assert.match(session.messages[0], /^\[INFOSERV2A_APP_RESULT\]/);

  await provider.stop();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("une syllabe en cours n’envoie pas de commande avant la fin de phrase", async () => {
  const commands = [];
  const video = fakeVideo();
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-phrase" })
  }).install({
    video,
    classifyCommand: async () => "site",
    onCommand: async (text) => commands.push(text)
  });

  await provider.connect({ microphone: false });
  const session = globalThis.__infoservFakeSession;
  session.emit("user-speak-started");
  session.emit("user-transcription", { text: "montre" });
  await wait(600);
  assert.deepEqual(commands, []);
  assert.equal(provider.realtimeSignal, "buffering-transcript");
  session.emit("user-transcription", { text: "montre moi la vidéosurveillance" });
  session.emit("user-speak-ended");
  await wait(600);
  assert.deepEqual(commands, ["montre moi la vidéosurveillance"]);
  assert.equal(session.interrupted, undefined);

  await provider.stop();
});

test("parler pendant que Claire s’exprime l’interrompt comme OpenAI Live", async () => {
  const video = fakeVideo();
  const barges = [];
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-barge" })
  }).install({
    video,
    onBargeIn: (detail) => barges.push(detail.reason)
  });

  await provider.connect({ microphone: true });
  const session = globalThis.__infoservFakeSession;
  session.emit("avatar-speak-started");
  assert.equal(provider.avatarSpeaking, true);
  session.emit("user-speak-started");
  assert.equal(session.interrupted, true);
  assert.equal(provider.avatarSpeaking, false);
  assert.equal(provider.userSpeaking, true);
  session.interrupted = false;
  session.emit("avatar-speak-started");
  session.emit("user-transcription", { text: "attends" });
  assert.equal(session.interrupted, true);
  assert.ok(barges.includes("user-barge-in"));

  await provider.stop();
});

test("un aparté hors site laisse Realtime répondre sans couper", async () => {
  const commands = [];
  const video = fakeVideo();
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-chat" })
  }).install({
    video,
    classifyCommand: async () => "chat",
    onCommand: async (text) => {
      commands.push(text);
      return { kind: "chat" };
    }
  });

  await provider.connect({ microphone: false });
  const session = globalThis.__infoservFakeSession;
  session.emit("user-speak-started");
  session.emit("user-transcription", { text: "bonjour comment ça va" });
  session.emit("user-speak-ended");
  await wait(600);
  assert.deepEqual(commands, ["bonjour comment ça va"]);
  assert.equal(session.interrupted, undefined);
  assert.equal(provider.realtimeSignal, "natural-reply");

  provider.sendContext("Page visible : Accueil InfoServ2A.");
  assert.match(session.messages.at(-1), /^\[INFOSERV2A_PAGE_CONTEXT\]/);

  await provider.stop();
});

test("la transcription de Claire est transmise pour synchroniser la page de droite", async () => {
  const spoken = [];
  const video = fakeVideo();
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-follow" })
  }).install({
    video,
    onAvatarTranscript: (text) => spoken.push(text)
  });

  await provider.connect({ microphone: true });
  const session = globalThis.__infoservFakeSession;
  session.emit("avatar-speak-started");
  session.emit("avatar-transcription", { text: "Voici l’onglet Vidéosurveillance" });
  assert.deepEqual(spoken, ["Voici l’onglet Vidéosurveillance"]);
  assert.equal(provider.avatarSpeaking, true);

  await provider.stop();
});

test("le prévol micro relâche les pistes pour que PC et téléphone partagent le même SDK", async () => {
  const stopped = [];
  const mediaDevices = {
    getUserMedia: async () => ({
      getTracks: () => [{
        stop() { stopped.push("audio"); }
      }]
    })
  };
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: mediaDevices
  });
  const video = fakeVideo();
  const provider = new InfoServ2ALiveAvatarProvider({
    sdkUrl,
    fetchImpl: async () => Response.json({ sessionToken: "ephemeral", sessionId: "session-preflight" })
  }).install({ video });

  assert.equal(await provider.preflightMicrophone(), true);
  assert.deepEqual(stopped, ["audio"]);
  assert.equal(video.playsInline, true);

  await provider.connect({ microphone: true });
  assert.equal(provider.connected, true);
  await provider.stop();
});
