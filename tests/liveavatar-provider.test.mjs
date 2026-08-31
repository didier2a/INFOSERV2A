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
  return {
    hidden: true,
    muted: true,
    volume: 0,
    srcObject: null,
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
    onCommand: async (text) => commands.push(text)
  });

  await provider.connect({ microphone: false });
  provider.stageTranscript("ouvre");
  provider.stageTranscript("ouvre la page vidéosurveillance");
  await provider.flushTranscript();
  await provider.speak("La page Vidéosurveillance est affichée.");

  const session = globalThis.__infoservFakeSession;
  assert.deepEqual(commands, ["ouvre la page vidéosurveillance"]);
  assert.equal(session.messages.length, 1);
  assert.match(session.messages[0], /^\[INFOSERV2A_APP_RESULT\]/);

  await provider.stop();
});
