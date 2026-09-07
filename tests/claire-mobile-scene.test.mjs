import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_SCENE_HOLD_MS,
  createMobileSceneState,
  mobileSceneActive,
  reduceMobileScene,
  sceneStatusLabel
} from "../assets/js/claire-mobile-scene.mjs";

test("IT43 : Parler allume la scène 9:16 sans presence speaking", () => {
  const afterStart = reduceMobileScene(createMobileSceneState(), "start");
  assert.deepEqual(afterStart, { on: true, zapped: false, heardSpeech: false });
  assert.equal(mobileSceneActive(afterStart, { phone: true, guided: true }), true);
  assert.equal(mobileSceneActive(afterStart, { phone: false, guided: true }), false);
  assert.equal(mobileSceneActive(afterStart, { phone: true, guided: false }), false);
  assert.equal(MOBILE_SCENE_HOLD_MS, 1000);
});

test("IT43 : zap et frappe cèdent le magasin", () => {
  const scene = reduceMobileScene(createMobileSceneState(), "start");
  assert.equal(reduceMobileScene(scene, "zap").on, false);
  assert.equal(reduceMobileScene(scene, "zap").zapped, true);
  assert.equal(reduceMobileScene(scene, "type").on, false);
  assert.equal(reduceMobileScene(scene, "type").zapped, true);
});

test("IT43 : sans parole LiveAvatar, le hold ne range pas la scène", () => {
  const afterStart = reduceMobileScene(createMobileSceneState(), "start");
  const afterHold = reduceMobileScene(afterStart, "speak-end-hold");
  assert.equal(afterHold.on, true);
  assert.equal(afterHold.heardSpeech, false);
  assert.equal(afterHold.zapped, false);
});

test("IT43 : parole puis silence + hold → magasin ; elle reprend → 9:16", () => {
  let state = reduceMobileScene(createMobileSceneState(), "start");
  state = reduceMobileScene(state, "speak-start");
  assert.equal(state.on, true);
  assert.equal(state.heardSpeech, true);
  state = reduceMobileScene(state, "speak-end-hold");
  assert.equal(state.on, false);
  assert.equal(state.zapped, false);
  state = reduceMobileScene(state, "speak-start");
  assert.equal(state.on, true);
});

test("IT46 : après zap, la parole ne ramène pas de force — l’humain tient le magasin", () => {
  let state = reduceMobileScene(createMobileSceneState(), "start");
  state = reduceMobileScene(state, "zap");
  assert.equal(state.on, false);
  assert.equal(state.zapped, true);
  state = reduceMobileScene(state, "speak-start");
  assert.equal(state.on, false);
  assert.equal(state.zapped, true);
  state = reduceMobileScene(state, "speak-end-hold");
  assert.equal(state.on, false);
  state = reduceMobileScene(state, "reopen");
  assert.equal(state.on, true);
  assert.equal(state.zapped, false);
});

test("IT46 : le statut dit où on en est, pas toujours « Elle vous parle »", () => {
  assert.equal(sceneStatusLabel("connecting"), "Claire arrive…");
  assert.equal(sceneStatusLabel("listening"), "Elle vous écoute");
  assert.equal(sceneStatusLabel("speaking"), "Elle vous parle");
  assert.equal(sceneStatusLabel("ready"), "Elle est avec vous");
  assert.equal(sceneStatusLabel("error"), "Sans voix live — voyez le site ou écrivez");
});

test("IT43 : PC n’active pas la scène mobile", () => {
  const afterStart = reduceMobileScene(createMobileSceneState(), "start");
  assert.equal(mobileSceneActive(afterStart, { phone: false, guided: true }), false);
});
