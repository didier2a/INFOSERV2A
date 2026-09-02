export const SITE_EMAIL_PATH = "/api/send-email";

export async function postSiteEmail(payload, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(SITE_EMAIL_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    sent: Boolean(data.sent),
    pendingActivation: Boolean(data.pendingActivation),
    configured: data.configured !== false,
    inbox: data.inbox || "",
    replyTo: data.replyTo || "",
    missing: Array.isArray(data.missing) ? data.missing : [],
    error: data.error || "",
    message: data.message || "",
    provider: data.provider || ""
  };
}

export function describeEmailSendOutcome(outcome) {
  const result = (outcome?.results || []).find((item) => item.tool === "compose_email" || item.tool === "submit_quote");
  if (!result) return "";
  const output = result.output || {};
  const inbox = output.inbox || "contact@infoserv2a.pro";
  const reply = output.replyTo ? ` La réponse arrivera sur ${output.replyTo}.` : "";
  if (output.sent) {
    return result.tool === "submit_quote"
      ? `La demande de devis a bien été envoyée vers ${inbox}.${reply}`
      : `Le message a bien été envoyé vers ${inbox}.${reply}`;
  }
  if (output.pendingActivation) {
    return `Je n’ai pas encore transmis le message. Un e-mail d’activation arrive dans ${inbox}. Ouvrez-le, confirmez, puis redemandez-moi d’envoyer.`;
  }
  if (Array.isArray(output.missing) && output.missing.length) {
    return `Je n’ai pas envoyé le message. Il me manque encore ${output.missing.join(", ")}.`;
  }
  if (output.configured === false) {
    return "Je n’ai pas pu envoyer l’e-mail depuis le site : l’envoi automatique n’est pas encore branché.";
  }
  return output.error
    ? `Je n’ai pas pu envoyer l’e-mail. ${output.error}`
    : "Je n’ai pas pu envoyer l’e-mail. Réessayez dans un instant, ou écrivez à contact@infoserv2a.pro.";
}
