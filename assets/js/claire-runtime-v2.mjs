import {
  adjacentPage,
  adjacentSection,
  classifyUtterance,
  catalogSpeech,
  normalizeText,
  pageById,
  resolveCurrentPage,
  isOralSendConfirm
} from "./claire-core.mjs?v=20260903-it27";
import {
  canSubmitQuote,
  canSubmitContact,
  describeQuoteChecklist,
  emailDraftFromMemory,
  quotePrefillFromMemory
} from "./claire-session-memory.mjs?v=20260903-it27";

export const CONTROLLER_STATES = Object.freeze({
  READY: "ready",
  INTERPRETING: "interpreting",
  PLANNING: "planning",
  EXECUTING: "executing",
  VERIFYING: "verifying",
  COMPLETE: "complete",
  ERROR: "error",
  MANUAL: "manual"
});

const TRANSITIONS = Object.freeze({
  ready: new Set(["interpreting"]),
  interpreting: new Set(["planning", "manual", "error"]),
  planning: new Set(["executing", "verifying", "error"]),
  executing: new Set(["verifying", "error"]),
  verifying: new Set(["complete", "error"]),
  complete: new Set(["interpreting", "ready"]),
  error: new Set(["interpreting", "ready"]),
  manual: new Set(["interpreting", "ready"])
});

function declaredTools(manifest) {
  return new Map((manifest.tools || []).map((tool) => [tool.name, tool]));
}

function validateToolCall(step, toolMap) {
  const definition = toolMap.get(step.tool);
  if (!definition) throw new Error("Outil non déclaré : " + step.tool);
  for (const key of definition.required || []) {
    if (step.args?.[key] === undefined || step.args?.[key] === "") {
      throw new Error("Argument manquant pour " + step.tool + " : " + key);
    }
  }
  return step;
}

function actionStep(tool, args, reason) {
  return { tool, args, reason };
}

function finishPlan({ command, route, steps, expected, mode, response }) {
  return {
    mode,
    command,
    normalizedCommand: normalizeText(command),
    intent: route.type || mode,
    steps,
    expected,
    response,
    suggestions: route.suggestions || []
  };
}

export function planCommand(input, knowledge, manifest, context = {}) {
  const command = String(input || "").trim();
  const routingCommand = command.replace(/[.!?…,:;]+$/u, "").trim();
  let classified = classifyUtterance(routingCommand, knowledge, context);
  if (classified.kind === "chat" && isOralSendConfirm(command)) {
    const pageId = context.pageId || "";
    if (pageId === "contact" && canSubmitContact(context.memory)) {
      classified = {
        kind: "site",
        route: { type: "action", action: "email", speech: "Je transmets votre message vers InfoServ2A." }
      };
    } else if (canSubmitQuote(context.memory)) {
      classified = {
        kind: "site",
        route: { type: "action", action: "submit_quote", speech: "Je transmets la demande de devis vers InfoServ2A." }
      };
    }
  }
  const route = classified.route || {};
  const steps = [];
  const current = resolveCurrentPage(knowledge, context);
  const toolMap = declaredTools(manifest);
  const validate = () => {
    steps.forEach((step) => validateToolCall(step, toolMap));
  };

  if (classified.kind === "control" && route.type === "manual") {
    return {
      mode: "manual",
      command,
      intent: route.id || "manual",
      steps,
      expected: null,
      response: route.speech
    };
  }

  if (classified.kind === "chat") {
    return finishPlan({
      command,
      route,
      steps,
      expected: null,
      mode: "chat",
      response: null
    });
  }

  if (classified.kind === "offtopic") {
    return finishPlan({
      command,
      route,
      steps,
      expected: null,
      mode: "offtopic",
      response: null
    });
  }

  if (classified.kind === "page") {
    steps.push(actionStep("explain_page", {
      page: route.page?.id || current?.id || "home"
    }, "Décrire l’onglet actuellement visible sans changer de page."));
    validate();
    return finishPlan({
      command,
      route,
      steps,
      expected: null,
      mode: "page",
      response: route.speech
    });
  }

  if (route.type === "catalog" || route.action === "list_catalog") {
    steps.push(actionStep("list_catalog", {}, "Énumérer tous les onglets du site."));
    validate();
    return finishPlan({
      command,
      route,
      steps,
      expected: null,
      mode: "controlled",
      response: route.speech || catalogSpeech(knowledge)
    });
  }

  if (route.action === "next_page" || route.action === "prev_page") {
    const direction = route.action === "next_page" ? 1 : -1;
    const page = adjacentPage(knowledge, current?.id || "home", direction);
    steps.push(actionStep(route.action, { from: current?.id || "home" }, "Parcourir le catalogue onglet par onglet."));
    validate();
    return finishPlan({
      command,
      route,
      steps,
      expected: page ? { pageId: page.id, anchorId: null } : null,
      mode: "controlled",
      response: page ? `Voici l’onglet « ${page.title} ». ${page.summary}` : route.speech
    });
  }

  if (route.action === "next_section" || route.action === "prev_section") {
    const direction = route.action === "next_section" ? 1 : -1;
    const page = current || resolveCurrentPage(knowledge, { pathname: "/" });
    const target = adjacentSection(page, context.sectionId || null, direction);
    steps.push(actionStep(route.action, {
      from: context.sectionId || null
    }, "Parcourir les sections de l’onglet visible."));
    validate();
    return finishPlan({
      command,
      route,
      steps,
      expected: {
        pageId: page?.id || current?.id || "home",
        anchorId: target?.id || context.sectionId || null
      },
      mode: "controlled",
      response: target
        ? (target.response || `Voici la section « ${target.label} ».`)
        : (direction > 0
          ? "Vous êtes déjà à la dernière section de cet onglet."
          : "Vous êtes déjà au début de cet onglet.")
    });
  }

  if (route.action === "go_home") {
    const home = route.page || pageById(knowledge, "home");
    steps.push(actionStep("go_home", {}, "Revenir à l’onglet d’accueil."));
    validate();
    return finishPlan({
      command,
      route,
      steps,
      expected: { pageId: home?.id || "home", anchorId: null },
      mode: "controlled",
      response: home?.summary || route.speech
    });
  }

  if (route.type === "action" && route.action === "submit_quote") {
    const draft = quotePrefillFromMemory(context.memory);
    if (canSubmitQuote(context.memory)) {
      steps.push(actionStep("submit_quote", draft, "Envoyer réellement la demande de devis vers InfoServ2A."));
    } else {
      steps.push(actionStep("prefill_quote", {
        ...draft,
        description: draft.description || "À préciser à l’oral"
      }, "Préparer le devis et demander à l’oral ce qui manque."));
    }
  } else if (route.type === "action" && route.action === "call") {
    steps.push(actionStep("start_call", {
      href: route.href || "tel:+33745156076"
    }, "Lancer l’appel vers InfoServ2A."));
  } else if (route.type === "action" && route.action === "email") {
    steps.push(actionStep("compose_email", emailDraftFromMemory(context.memory), "Envoyer réellement le message vers contact@infoserv2a.pro."));
  } else if (route.page) {
    steps.push(actionStep("search_site", { query: command }, "Identifier la page et la section les plus pertinentes."));
    if (route.page.id === "contact") {
      steps.push(actionStep("open_contact", { channel: "form" }, "Afficher les moyens de contact."));
    } else {
      steps.push(actionStep("open_service", { service: route.page.id }, "Ouvrir l’onglet dans l’aperçu contrôlé."));
    }
    if (route.page.id === "quote") {
      const draft = quotePrefillFromMemory(context.memory, { fallbackDescription: command });
      steps.push(actionStep("prefill_quote", draft, "Préparer un brouillon. L’envoi n’a lieu que sur demande orale explicite."));
    }
    if (route.anchor?.id) {
      steps.push(actionStep("scroll_to", { target: route.anchor.id }, "Positionner l’aperçu sur la section déclarée."));
    }
  }

  validate();
  const expected = route.page ? {
    pageId: route.page.id,
    anchorId: route.anchor?.id || null
  } : route.action === "submit_quote" ? {
    pageId: "quote",
    anchorId: null
  } : route.type === "action" ? {
    pageId: "contact",
    anchorId: null
  } : null;

  let response = route.anchor?.response || route.speech;
  if (route.action === "submit_quote" || route.page?.id === "quote") {
    const checklist = describeQuoteChecklist(context.memory);
    if (!checklist.complete || route.action !== "submit_quote") {
      response = checklist.speech;
    } else {
      response = "Je transmets la demande de devis. Je ne confirmerai l’envoi que lorsque le site l’aura vraiment envoyé.";
    }
  }

  return finishPlan({
    command,
    route,
    steps,
    expected,
    mode: "controlled",
    response
  });
}

export class ClaireRuntimeController {
  constructor({ knowledge, manifest, adapter, clock = () => new Date().toISOString() }) {
    if (!knowledge || !manifest || !adapter) throw new Error("Runtime Claire incomplet");
    this.knowledge = knowledge;
    this.manifest = manifest;
    this.adapter = adapter;
    this.clock = clock;
    this.state = CONTROLLER_STATES.READY;
    this.activeCommandId = null;
    this.commandSequence = 0;
    this.eventSequence = 0;
    this.events = [];
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(type, payload = {}) {
    const event = Object.freeze({
      sequence: ++this.eventSequence,
      at: this.clock(),
      commandId: this.activeCommandId,
      type,
      state: this.state,
      payload
    });
    this.events.push(event);
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* l’observateur ne contrôle jamais le runtime */ }
    }
    return event;
  }

  transition(next, detail = {}) {
    if (!TRANSITIONS[this.state]?.has(next)) {
      throw new Error("Transition interdite : " + this.state + " → " + next);
    }
    const previous = this.state;
    this.state = next;
    this.publish("state.changed", { previous, next, ...detail });
  }

  async run(input, context = {}) {
    if (this.activeCommandId) throw new Error("Une commande Claire est déjà en cours");
    this.activeCommandId = "cmd-" + String(++this.commandSequence).padStart(4, "0");
    const commandId = this.activeCommandId;
    try {
      this.transition(CONTROLLER_STATES.INTERPRETING, { input: String(input || "") });
      const plan = planCommand(input, this.knowledge, this.manifest, context);
      if (plan.mode === "manual") {
        this.transition(CONTROLLER_STATES.MANUAL);
        this.publish("command.completed", { plan, results: [], verification: { ok: true, mode: "manual" } });
        return { commandId, plan, results: [], verification: { ok: true, mode: "manual" }, state: this.state };
      }

      this.transition(CONTROLLER_STATES.PLANNING, { stepCount: plan.steps.length });
      this.publish("plan.created", { plan });
      const results = [];
      if (plan.steps.length) {
        this.transition(CONTROLLER_STATES.EXECUTING);
        for (const [index, step] of plan.steps.entries()) {
          this.publish("tool.started", { index, step });
          const output = await this.adapter.execute(step.tool, step.args, { commandId, index });
          results.push({ tool: step.tool, output });
          this.publish("tool.completed", { index, tool: step.tool, output });
        }
      }
      this.transition(CONTROLLER_STATES.VERIFYING);
      const verification = await this.adapter.verify(plan, results);
      this.publish("verification.completed", verification);
      if (!verification.ok) throw new Error(verification.reason || "Vérification impossible");
      this.transition(CONTROLLER_STATES.COMPLETE);
      this.publish("command.completed", { plan, results, verification });
      this.transition(CONTROLLER_STATES.READY);
      return { commandId, plan, results, verification, state: this.state };
    } catch (error) {
      if (this.state !== CONTROLLER_STATES.ERROR) {
        this.transition(CONTROLLER_STATES.ERROR, { message: error.message });
      }
      this.publish("command.failed", { message: error.message });
      if (TRANSITIONS[this.state]?.has(CONTROLLER_STATES.READY)) {
        this.transition(CONTROLLER_STATES.READY);
      }
      throw error;
    } finally {
      this.activeCommandId = null;
    }
  }
}
