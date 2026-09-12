export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[0-9 +().-]{8,20}$/;

export const QUOTE_SCHEMA = Object.freeze({
  name: Object.freeze({ required: true, max: 80, label: "votre nom" }),
  phone: Object.freeze({ required: true, max: 40, label: "votre téléphone", pattern: PHONE_PATTERN }),
  email: Object.freeze({ required: true, max: 120, label: "votre e-mail", pattern: EMAIL_PATTERN }),
  city: Object.freeze({ required: true, max: 80, label: "votre commune" }),
  service: Object.freeze({ required: true, max: 80, label: "le type de service" }),
  description: Object.freeze({ required: true, max: 4000, label: "la description du besoin", multiline: true })
});

export const CONTACT_SCHEMA = Object.freeze({
  name: QUOTE_SCHEMA.name,
  email: QUOTE_SCHEMA.email,
  phone: Object.freeze({ required: false, max: 40, label: "votre téléphone", pattern: PHONE_PATTERN }),
  message: Object.freeze({ required: true, max: 4000, label: "votre message", multiline: true })
});

export function compactSingleLine(value = "", max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function compactMultiline(value = "", max = 4000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function isPlaceholderFormValue(value = "") {
  return compactSingleLine(value, 200)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, " ") === "a preciser a l oral";
}

export function normalizeSchemaValue(value, definition = {}) {
  const normalized = definition.multiline
    ? compactMultiline(value, definition.max)
    : compactSingleLine(value, definition.max);
  return isPlaceholderFormValue(normalized) ? "" : normalized;
}

export function validateFields(values = {}, schema = QUOTE_SCHEMA) {
  const normalized = {};
  const fieldErrors = {};
  for (const [field, definition] of Object.entries(schema)) {
    const value = normalizeSchemaValue(values[field], definition);
    normalized[field] = value;
    if (definition.required && !value) {
      fieldErrors[field] = `Veuillez renseigner ${definition.label}.`;
    } else if (value && definition.pattern && !definition.pattern.test(value)) {
      fieldErrors[field] = field === "email"
        ? "L’adresse e-mail n’est pas valide."
        : "Le numéro de téléphone n’est pas valide.";
    }
  }
  const invalid = Object.keys(fieldErrors);
  return {
    valid: invalid.length === 0,
    normalized,
    invalid,
    fieldErrors
  };
}

export function validateQuoteFields(values = {}) {
  return validateFields(values, QUOTE_SCHEMA);
}

export function validateContactFields(values = {}) {
  return validateFields(values, CONTACT_SCHEMA);
}
