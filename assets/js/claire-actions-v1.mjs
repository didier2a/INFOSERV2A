import { normalizeText } from "./claire-core.mjs?v=20260912-combo3star-pip-v1";
import {
  canSubmitContact,
  canSubmitQuote,
  synthesizeMailBody,
  validateContactDraft,
  validateQuoteDraft
} from "./claire-session-memory.mjs?v=20260912-combo3star-pip-v1";

export const CLAIRE_ACTION_MODES = Object.freeze({
  CONSEIL: "conseil",
  DEVIS: "devis",
  CONTACT: "contact"
});

const EXACT_CONFIRMATION_PATTERN = /(?:^|\b)oui envoie (?:(?:ma|la) )?demande de (devis|contact)$/;

export function exactConfirmationKind(value = "") {
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
  const validation = kind === CLAIRE_ACTION_MODES.CONTACT
    ? validateContactDraft(memory)
    : validateQuoteDraft(memory);
  const ready = validation.valid;
  if (ready) {
    return {
      ready: true,
      canvas,
      askedField: "",
      fieldErrors: {},
      speech: `J’ai mis la synthèse à jour dans le formulaire. Relisez-la puis, si elle vous convient, dites exactement : « ${confirmationPhrase(kind)} ».`
    };
  }
  const askedField = validation.invalid[0] || "";
  const questions = {
    name: "Quel est votre nom et prénom ?",
    phone: "Quel est votre numéro de téléphone ?",
    email: "Quelle est votre adresse e-mail ?",
    city: "Dans quelle commune êtes-vous ?",
    service: "Quel type de service souhaitez-vous ?",
    description: "Décrivez précisément votre besoin.",
    message: "Quel message souhaitez-vous transmettre ?"
  };
  const error = validation.fieldErrors[askedField] || "";
  const correction = error && !/^Veuillez renseigner/i.test(error) ? `${error} ` : "";
  return {
    ready: false,
    canvas,
    askedField,
    fieldErrors: validation.fieldErrors,
    speech: `${correction}${questions[askedField] || "Pouvez-vous préciser ce champ ?"}`.trim()
  };
}

export function actionOpeningSpeech(kind) {
  const field = kind === CLAIRE_ACTION_MODES.CONTACT ? "message de contact" : "champ besoin du devis";
  return `D’accord. Je passe en mode ${kind} et je vais synthétiser notre échange dans le ${field}. Rien ne sera envoyé sans votre confirmation explicite.`;
}
