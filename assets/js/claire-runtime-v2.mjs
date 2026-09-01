import { normalizeText, routeCommand } from "./claire-core.mjs";

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

export function planCommand(input, knowledge, manifest, context = {}) {
  const command = String(input || "").trim();
  const routingCommand = command.replace(/[.!?…,:;]+$/u, "").trim();
  const route = routeCommand(routingCommand, knowledge, context);
  const steps = [];

  if (route.type === "manual") {
    return {
      mode: "manual",
      command,
      intent: route.id || "manual",
      steps,
      expected: null,
      response: route.speech
    };
  }

  if (route.type === "action" && (route.action === "call" || route.action === "email")) {
    steps.push(actionStep("open_contact", { channel: route.action }, "Présenter le canal demandé sans le déclencher."));
  } else if (route.page) {
    steps.push(actionStep("search_site", { query: command }, "Identifier la page et la section les plus pertinentes."));
    if (route.page.id === "contact") {
      steps.push(actionStep("open_contact", { channel: "form" }, "Afficher les moyens de contact."));
    } else {
      steps.push(actionStep("open_service", { service: route.page.id }, "Ouvrir la page dans l’aperçu contrôlé."));
    }
    if (route.page.id === "quote") {
      steps.push(actionStep("prefill_quote", {
        service: "",
        description: command
      }, "Préparer un brouillon sans jamais soumettre le formulaire."));
    }
    if (route.anchor?.id) {
      steps.push(actionStep("scroll_to", { target: route.anchor.id }, "Positionner l’aperçu sur la section déclarée."));
    }
  }

  const toolMap = declaredTools(manifest);
  steps.forEach((step) => validateToolCall(step, toolMap));
  const expected = route.page ? {
    pageId: route.page.id,
    anchorId: route.anchor?.id || null
  } : route.type === "action" ? {
    pageId: "contact",
    anchorId: null
  } : null;

  return {
    mode: "controlled",
    command,
    normalizedCommand: normalizeText(command),
    intent: route.type,
    steps,
    expected,
    response: route.anchor?.response || route.speech,
    suggestions: route.suggestions || []
  };
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
