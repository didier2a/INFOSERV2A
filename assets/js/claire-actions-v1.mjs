import { normalizeText } from "./claire-core.mjs?v=20260911-claire-send-truth-v1";
import {
  canSubmitContact,
  canSubmitQuote,
  describeMissingQuoteFields,
  synthesizeMailBody
} from "./claire-session-memory.mjs?v=20260911-claire-send-truth-v1";

export const CLAIRE_ACTION_MODES = Object.freeze({
  CONSEIL: "conseil",
  DEVIS: "devis",
  CONTACT: "contact"
});

const EXACT_CONFIRMATIONS = Object.freeze({
  devis: "oui envoie ma demande de devis",
  contact: "oui envoie ma demande de contact"
});

export function requestedActionMode(value = "") {
  const query = normalizeText(value);
  if (!query) return "";
  if (Object.values(EXACT_CONFIRMATIONS).includes(query)) return "";
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
  const expected = EXACT_CONFIRMATIONS[kind];
  return Boolean(expected && normalizeText(value) === expected);
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
