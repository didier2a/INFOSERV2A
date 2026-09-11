const TENANTS = Object.freeze({
  "boulangerie-soleil": Object.freeze({
    id: "boulangerie-soleil",
    displayName: "Boulangerie du Soleil",
    allowedOrigins: Object.freeze([
      "https://boulangerie-du-soleil.example",
      "https://www.boulangerie-du-soleil.example",
      "http://localhost:4173"
    ]),
    persona: Object.freeze({
      name: "Claire",
      locale: "fr-FR",
      voice: "marin",
      greeting: "Bonjour, je suis Claire. Comment puis-je vous conseiller aujourd’hui ?",
      instructions: "Tu conseilles les visiteurs avec chaleur et concision. Tu n’inventes ni prix, ni disponibilité."
    }),
    knowledge: Object.freeze([
      "Boulangerie artisanale fictive.",
      "Les commandes spéciales doivent être confirmées par l’équipe."
    ]),
    delivery: Object.freeze({
      webhookEnv: "LEAD_WEBHOOK_BOULANGERIE_SOLEIL",
      emailEnv: "LEAD_EMAIL_BOULANGERIE_SOLEIL"
    }),
    quota: Object.freeze({ minutesPerMonth: 60, maxSessionSeconds: 300 })
  }),
  "atelier-lumiere": Object.freeze({
    id: "atelier-lumiere",
    displayName: "Atelier Lumière",
    allowedOrigins: Object.freeze([
      "https://atelier-lumiere.example",
      "https://www.atelier-lumiere.example",
      "http://localhost:4174"
    ]),
    persona: Object.freeze({
      name: "Claire",
      locale: "fr-FR",
      voice: "marin",
      greeting: "Bienvenue à l’Atelier Lumière. Je peux vous aider à préparer votre projet.",
      instructions: "Tu aides à cadrer un projet photo sans promettre de tarif ou de créneau."
    }),
    knowledge: Object.freeze([
      "Studio photo fictif pour portraits et projets de marque.",
      "Un membre de l’atelier confirme chaque demande."
    ]),
    delivery: Object.freeze({
      webhookEnv: "LEAD_WEBHOOK_ATELIER_LUMIERE",
      emailEnv: "LEAD_EMAIL_ATELIER_LUMIERE"
    }),
    quota: Object.freeze({ minutesPerMonth: 90, maxSessionSeconds: 300 })
  })
});

export function getTenant(id) {
  return TENANTS[String(id || "").trim()] || null;
}

export function listTenantIds() {
  return Object.keys(TENANTS);
}

export function publicTenant(tenant) {
  return {
    id: tenant.id,
    displayName: tenant.displayName,
    persona: {
      name: tenant.persona.name,
      locale: tenant.persona.locale,
      greeting: tenant.persona.greeting
    },
    features: {
      liveAvatar: true,
      leadForm: true
    },
    quota: {
      maxSessionSeconds: tenant.quota.maxSessionSeconds
    }
  };
}
