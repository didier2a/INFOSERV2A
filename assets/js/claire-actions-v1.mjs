import { normalizeText } from "./claire-core.mjs?v=20260911-claire-send-loop-v1";
import {
  canSubmitContact,
  canSubmitQuote,
  describeMissingQuoteFields,
  synthesizeMailBody
} from "./claire-session-memory.mjs?v=20260911-claire-send-loop-v1";

export const CLAIRE_ACTION_MODES = Object.freeze({
  CONSEIL: "conseil",
  DEVIS: "devis",
  CONTACT: "contact"
});

const EXACT_CONFIRMATION_PATTERN = /^oui envoie (?:(?:ma|la) )?demande de (devis|contact)$/;

function exactConfirmationKind(value = "") {
  return normalizeText(value).match(EXACT_CONFIRMATION_PATTERN)?.[1] || "";
}

export function requestedActionMode(value = "") {
  const query = normalizeText(value);
  if (!query) return "";
  if (exactConfirmationKind(query)) return "";
  if (isQuoteResendRequest(query)) return CLAIRE_ACTION_MODES.DEVIS;
  if (
    /\b(je (?:veux|voudrais|souhaite|demande)|peux tu|pourrais tu|on peut|faire|preparer|ouvrir).{0,40}\bdevis\b/.test(query)
    || /\bdemande de devis\b/.test(query)
    || /\b(envoie|transmets|soumet).{0,24}\bdevis\b/.test(query)
  ) {
    return CLAIRE_ACTION_MODES.DEVIS;
  }
  if (
    /\b(je (?:veux|voudrais|souhaite)|peux tu|pourrais tu|on peut).{0,44}\b(contact|message|etre rappele)\b/.test(query)
    || /\b(demande de contact|prendre contact|envoyer un message)\b/.test(query)
    || /\b(envoie|transmets).{0,24}\b(message|contact)\b/.test(query)
  ) {
    return CLAIRE_ACTION_MODES.CONTACT;
  }
  return "";
}

export function confirmationPhrase(kind) {
  const normalized = kind === CLAIRE_ACTION_MODES.CONTACT
    ? CLAIRE_ACTION_MODES.CONTACT
    : CLAIRE_ACTION_MODES.DEVIS;
  return `Oui, envoie ma demande de ${normalized}`;
}

export function isExactSendConfirmation(value = "", kind = "") {
  return exactConfirmationKind(value) === kind;
}

export function isQuoteResendRequest(value = "") {
  const query = normalizeText(value);
  return /\b(?:renvoie|renvoyer|renvoyez|relance|relancer|relancez)\b.{0,36}\b(?:devis|demande de devis)\b/.test(query);
}

export function shouldDebounceVoiceCommand(
  value = "",
  kind = "",
  { lastCommand = "", lastCommandAt = 0, now = Date.now(), runtimeActive = false } = {}
) {
  if (runtimeActive) return true;
  if (isExactSendConfirmation(value, kind)) return false;
  const signature = String(value || "").toLocaleLowerCase("fr").replace(/\s+/g, " ");
  return signature === lastCommand && now - lastCommandAt < 4000;
}

export function actionDraftReady(kind, memory = {}) {
  return kind === CLAIRE_ACTION_MODES.CONTACT
    ? canSubmitContact(memory)
    : kind === CLAIRE_ACTION_MODES.DEVIS && canSubmitQuote(memory);
}

export function interviewUpdate(kind, memory = {}) {
  const canvas = synthesizeMailBody(memory);
  const ready = actionDraftReady(kind, memory);
  if (ready) {
    return {
      ready: true,
      canvas,
      speech: `J’ai mis la synthèse à jour dans le formulaire. Relisez-la puis, si elle vous convient, dites exactement : « ${confirmationPhrase(kind)} ».`
    };
  }
  if (kind === CLAIRE_ACTION_MODES.CONTACT) {
    const missing = [
      !memory?.visitor?.name && "votre nom",
      !memory?.visitor?.email && "votre e-mail",
      !canvas && "votre message"
    ].filter(Boolean);
    return {
      ready: false,
      canvas,
      speech: `Je synthétise notre échange dans le message. Il me manque encore ${missing.join(", ")}.`
    };
  }
  return {
    ready: false,
    canvas,
    speech: `Je synthétise notre échange dans le champ besoin. Il me manque encore ${describeMissingQuoteFields(memory)}.`
  };
}

export function actionOpeningSpeech(kind) {
  const field = kind === CLAIRE_ACTION_MODES.CONTACT ? "message de contact" : "champ besoin du devis";
  return `D’accord. Je passe en mode ${kind} et je vais synthétiser notre échange dans le ${field}. Rien ne sera envoyé sans votre confirmation explicite.`;
}
