import { ClaireRuntimeController } from "./claire-runtime-v2.mjs?v=20260902-it23";
import { followSpokenNavigation } from "./claire-core.mjs?v=20260902-it23";
import { InfoServ2ALabAdapter } from "./claire-site-adapter.mjs?v=20260902-it23";

const stateLabels = {
  ready: "Prête",
  interpreting: "Interprétation",
  planning: "Planification",
  executing: "Exécution",
  verifying: "Vérification",
  complete: "Terminé",
  error: "Erreur",
  manual: "Manuel"
};

const elements = {
  form: document.querySelector("#lab-form"),
  input: document.querySelector("#lab-command"),
  submit: document.querySelector("#lab-submit"),
  state: document.querySelector("#lab-state"),
  transcript: document.querySelector("#lab-transcript"),
  plan: document.querySelector("#lab-plan"),
  preview: document.querySelector("#lab-preview"),
  verification: document.querySelector("#lab-verification"),
  events: document.querySelector("#lab-events"),
  reset: document.querySelector("#lab-reset")
};

function clear(target) {
  while (target.firstChild) target.firstChild.remove();
}

function createNode(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function addTurn(role, text) {
  const turn = createNode("article", "lab-turn lab-turn--" + role);
  turn.append(createNode("strong", "", role === "claire" ? "Claire" : "Vous"));
  turn.append(createNode("p", "", text));
  elements.transcript.append(turn);
  elements.transcript.scrollTop = elements.transcript.scrollHeight;
}

function setState(state) {
  elements.state.dataset.state = state;
  elements.state.textContent = stateLabels[state] || state;
}

function eventSummary(event) {
  if (event.type === "state.changed") return event.payload.previous + " → " + event.payload.next;
  if (event.type === "tool.started") return event.payload.step.tool;
  if (event.type === "tool.completed") return event.payload.tool + " confirmé";
  if (event.type === "verification.completed") return event.payload.ok ? "résultat conforme" : "échec de vérification";
  if (event.type === "plan.created") return event.payload.plan.steps.length + " outil(s) planifié(s)";
  if (event.type === "command.failed") return event.payload.message;
  return event.type;
}

function appendEvent(event) {
  const empty = elements.events.querySelector(".lab-empty");
  if (empty) empty.remove();
  const item = createNode("li", "lab-event");
  item.append(createNode("span", "lab-event__sequence", String(event.sequence).padStart(2, "0")));
  const body = createNode("div");
  body.append(createNode("strong", "", event.type));
  body.append(createNode("p", "", eventSummary(event)));
  item.append(body);
  elements.events.append(item);
  elements.events.scrollTop = elements.events.scrollHeight;
}

function renderPlan(plan) {
  clear(elements.plan);
  if (!plan.steps.length) {
    elements.plan.append(createNode("li", "lab-empty", "Aucun outil nécessaire pour cette réponse."));
    return;
  }
  plan.steps.forEach((step, index) => {
    const item = createNode("li", "lab-plan__step");
    item.append(createNode("span", "lab-plan__index", String(index + 1).padStart(2, "0")));
    const body = createNode("div");
    body.append(createNode("strong", "", step.tool));
    body.append(createNode("p", "", step.reason));
    body.append(createNode("code", "", JSON.stringify(step.args)));
    item.append(body);
    elements.plan.append(item);
  });
}

function renderPreview(snapshot, verification) {
  clear(elements.preview);
  elements.verification.textContent = verification.ok ? "Vérifié" : "Échec";
  elements.verification.classList.toggle("lab-pill--error", !verification.ok);
  if (!snapshot.page) {
    elements.preview.append(createNode("p", "lab-empty", verification.reason || "Aucune page sélectionnée."));
    return;
  }
  elements.preview.append(createNode("p", "lab-preview__eyebrow", snapshot.page.id));
  elements.preview.append(createNode("h3", "", snapshot.page.title));
  elements.preview.append(createNode("p", "", snapshot.page.summary));
  if (snapshot.section) {
    const section = createNode("div", "lab-preview__section");
    section.append(createNode("strong", "", snapshot.section.label));
    section.append(createNode("p", "", snapshot.section.response || "Section déclarée et visible dans l’aperçu."));
    elements.preview.append(section);
  }
  const target = snapshot.page.href + (snapshot.section ? "#" + snapshot.section.id : "");
  const link = createNode("a", "lab-preview__link", "Ouvrir manuellement la page vérifiée");
  link.href = target;
  link.target = "_blank";
  link.rel = "noopener";
  elements.preview.append(link);
}

async function loadRuntime() {
  const [knowledgeResponse, manifestResponse] = await Promise.all([
    fetch("/data/site-knowledge.json", { cache: "no-store" }),
    fetch("/data/claire-capabilities.json", { cache: "no-store" })
  ]);
  if (!knowledgeResponse.ok || !manifestResponse.ok) {
    throw new Error("Impossible de charger le manifeste Claire");
  }
  const [knowledge, manifest] = await Promise.all([
    knowledgeResponse.json(),
    manifestResponse.json()
  ]);
  const adapter = new InfoServ2ALabAdapter({ knowledge, manifest });
  const controller = new ClaireRuntimeController({ knowledge, manifest, adapter });
  controller.subscribe((event) => {
    setState(event.state);
    appendEvent(event);
  });
  return { controller, adapter, knowledge, manifest };
}

let runtime;
try {
  runtime = await loadRuntime();
} catch (error) {
  setState("error");
  addTurn("claire", "Le laboratoire ne peut pas démarrer : " + error.message);
  elements.submit.disabled = true;
}

async function executeCommand(command) {
  if (!runtime || !command.trim()) return;
  elements.submit.disabled = true;
  elements.input.disabled = true;
  elements.verification.textContent = "En cours";
  elements.verification.classList.remove("lab-pill--error");
  addTurn("user", command.trim());
  try {
    const outcome = await runtime.controller.run(command, { pathname: "/" });
    renderPlan(outcome.plan);
    renderPreview(runtime.adapter.snapshot(), outcome.verification);
    addTurn("claire", outcome.plan.response || "La commande a été exécutée et vérifiée.");
  } catch (error) {
    elements.verification.textContent = "Échec";
    elements.verification.classList.add("lab-pill--error");
    addTurn("claire", "Je n’ai pas exécuté la commande : " + error.message);
  } finally {
    elements.submit.disabled = false;
    elements.input.disabled = false;
    elements.input.value = "";
    elements.input.focus();
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void executeCommand(elements.input.value);
});

document.querySelectorAll("[data-lab-command]").forEach((button) => {
  button.addEventListener("click", () => void executeCommand(button.dataset.labCommand || ""));
});

document.querySelectorAll("[data-lab-follow]").forEach((button) => {
  button.addEventListener("click", () => void followSpeech(button.dataset.labFollow || ""));
});

elements.reset.addEventListener("click", () => location.reload());

async function followSpeech(text) {
  if (!runtime || !text.trim()) return;
  elements.submit.disabled = true;
  addTurn("claire", text.trim());
  try {
    const snapshot = runtime.adapter.snapshot();
    const target = followSpokenNavigation(text, runtime.knowledge, {
      pageId: snapshot.activePage,
      sectionId: snapshot.activeSection
    });
    if (!target) {
      elements.verification.textContent = "Aucun onglet à suivre";
      renderPreview(snapshot, { ok: true, reason: "Parole hors navigation" });
      return;
    }
    const results = [];
    if (target.pageId !== snapshot.activePage) {
      results.push({ tool: "open_service", output: await runtime.adapter.execute("open_service", { service: target.pageId }) });
    }
    if (target.anchorId) {
      results.push({ tool: "scroll_to", output: await runtime.adapter.execute("scroll_to", { target: target.anchorId }) });
    }
    renderPlan({
      steps: results.map((result) => ({
        tool: result.tool,
        reason: "Synchroniser la page de droite avec la parole de Claire.",
        args: result.tool === "open_service" ? { service: target.pageId } : { target: target.anchorId }
      }))
    });
    const next = runtime.adapter.snapshot();
    renderPreview(next, { ok: true, pageId: next.activePage, anchorId: next.activeSection });
    elements.verification.textContent = "Synchronisé";
  } catch (error) {
    elements.verification.textContent = "Échec";
    elements.verification.classList.add("lab-pill--error");
    addTurn("claire", "Je n’ai pas pu suivre la parole : " + error.message);
  } finally {
    elements.submit.disabled = false;
  }
}
