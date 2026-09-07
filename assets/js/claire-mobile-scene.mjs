export const MOBILE_SCENE_HOLD_MS = 1000;

export function createMobileSceneState() {
  return { on: false, zapped: false, heardSpeech: false };
}

export function reduceMobileScene(state, event) {
  const current = state && typeof state === "object" ? state : createMobileSceneState();
  switch (event) {
    case "start":
      return { on: true, zapped: false, heardSpeech: false };
    case "zap":
    case "type":
    case "interrupt":
      return { on: false, zapped: true, heardSpeech: Boolean(current.heardSpeech) };
    case "speak-start":
      if (current.zapped) {
        return { on: false, zapped: true, heardSpeech: true };
      }
      return { on: true, zapped: false, heardSpeech: true };
    case "reopen":
      return { on: true, zapped: false, heardSpeech: Boolean(current.heardSpeech) };
    case "speak-end-hold":
      if (current.zapped) {
        return { on: false, zapped: true, heardSpeech: Boolean(current.heardSpeech) };
      }
      if (!current.heardSpeech) {
        return { on: true, zapped: false, heardSpeech: false };
      }
      return { on: false, zapped: false, heardSpeech: true };
    case "reset":
      return createMobileSceneState();
    default:
      return {
        on: Boolean(current.on),
        zapped: Boolean(current.zapped),
        heardSpeech: Boolean(current.heardSpeech)
      };
  }
}

export function mobileSceneActive(state, { phone = false, guided = false } = {}) {
  return Boolean(phone && guided && state?.on);
}

export function sceneStatusLabel(presence) {
  switch (presence) {
    case "speaking":
    case "sound":
      return "Elle vous parle";
    case "connecting":
    case "thinking":
      return "Claire arrive…";
    case "error":
      return "Sans voix live — voyez le site ou écrivez";
    case "listening":
      return "Elle vous écoute";
    default:
      return "Elle est avec vous";
  }
}
