import { adjacentPage, adjacentSection, catalogEntries, currentPage, pageById, scorePage } from "./claire-core.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanPath(value, base = "https://infoserv2a.pro/") {
  const url = new URL(value || "/", base);
  return url.pathname.replace(/^\//, "") || "index.html";
}

function pageSummary(page) {
  return {
    id: page.id,
    title: page.title,
    href: page.href,
    summary: page.summary
  };
}

function quoteDraftFromArgs(args = {}) {
  return {
    name: String(args.name || "").slice(0, 80),
    phone: String(args.phone || "").slice(0, 40),
    email: String(args.email || "").slice(0, 120),
    city: String(args.city || "").slice(0, 80),
    service: String(args.service || "").slice(0, 80),
    description: String(args.description || "").slice(0, 500)
  };
}

export class BrowserInfoServ2ASurface {
  constructor({
    knowledge,
    windowRef = globalThis.window,
    documentRef = globalThis.document,
    fetchImpl = globalThis.fetch
  }) {
    if (!knowledge || !windowRef || !documentRef || !fetchImpl) {
      throw new Error("Surface InfoServ2A indisponible");
    }
    this.knowledge = knowledge;
    this.window = windowRef;
    this.document = documentRef;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.allowedPages = new Map(
      (knowledge.pages || []).map((page) => [cleanPath(page.href, this.window.location.href), page])
    );
    this.activePageId = currentPage(knowledge, this.window.location.pathname)?.id || null;
    this.activeSectionId = this.window.location.hash ? decodeURIComponent(this.window.location.hash.slice(1)) : null;
    this.navigationCount = 0;
    this.pageCache = new Map();
  }

  pageUrl(page) {
    return new URL(page.href, this.window.location.origin + "/").href;
  }

  async prefetchPage(page) {
    const declared = this.allowedPages.get(cleanPath(page?.href, this.window.location.href));
    if (!declared) return false;
    const href = this.pageUrl(declared);
    if (this.pageCache.has(href)) return true;
    const pending = this.fetchImpl(href, {
      method: "GET",
      credentials: "same-origin",
      headers: { "X-InfoServ2A-Navigation": "Claire-Runtime-V2" }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Page InfoServ2A HTTP ${response.status}`);
      const html = await response.text();
      this.pageCache.set(href, html);
      return html;
    }).catch(() => {
      this.pageCache.delete(href);
      return null;
    });
    this.pageCache.set(href, pending);
    return true;
  }

  async htmlForPage(declared) {
    const href = this.pageUrl(declared);
    const cached = this.pageCache.get(href);
    if (typeof cached === "string") return cached;
    if (cached && typeof cached.then === "function") {
      const html = await cached;
      if (typeof html === "string") return html;
    }
    const response = await this.fetchImpl(href, {
      method: "GET",
      credentials: "same-origin",
      headers: { "X-InfoServ2A-Navigation": "Claire-Runtime-V2" }
    });
    if (!response.ok) throw new Error(`Page InfoServ2A HTTP ${response.status}`);
    const html = await response.text();
    this.pageCache.set(href, html);
    return html;
  }

  resolvePage(value) {
    const url = new URL(value, this.window.location.href);
    if (url.origin !== this.window.location.origin) return null;
    return this.allowedPages.get(cleanPath(url.href, this.window.location.href)) || null;
  }

  hrefFor(page, anchorId = null) {
    const url = new URL(page.href, this.window.location.origin + "/");
    url.search = "";
    url.hash = anchorId ? `#${encodeURIComponent(anchorId)}` : "";
    return `${url.pathname}${url.hash}`;
  }

  parseDocument(html) {
    const Parser = this.window.DOMParser || globalThis.DOMParser;
    if (!Parser) throw new Error("Analyse HTML indisponible");
    return new Parser().parseFromString(html, "text/html");
  }

  updateMetadata(nextDocument) {
    if (nextDocument.title) this.document.title = nextDocument.title;
    const nextDescription = nextDocument.querySelector('meta[name="description"]')?.content;
    const currentDescription = this.document.querySelector('meta[name="description"]');
    if (nextDescription && currentDescription) currentDescription.content = nextDescription;
  }

  updateCurrentNavigation(page) {
    const targetPath = cleanPath(page.href, this.window.location.href);
    this.document.querySelectorAll('a[aria-current="page"]').forEach((link) => link.removeAttribute("aria-current"));
    this.document.querySelectorAll("a[href]").forEach((link) => {
      let url;
      try { url = new URL(link.getAttribute("href"), this.window.location.href); } catch { return; }
      if (url.origin !== this.window.location.origin) return;
      if (cleanPath(url.href, this.window.location.href) === targetPath) link.setAttribute("aria-current", "page");
    });
  }

  async openPage(page, { historyMode = "push", scroll = true } = {}) {
    const declared = this.allowedPages.get(cleanPath(page?.href, this.window.location.href));
    if (!declared || declared.id !== page.id) throw new Error("Page refusée par l’index InfoServ2A");

    const currentMain = this.document.querySelector("#contenu");
    if (!currentMain) throw new Error("Contenu principal InfoServ2A introuvable");
    currentMain.setAttribute("aria-busy", "true");
    this.document.body.classList.add("claire-content-loading");

    try {
      const html = await this.htmlForPage(declared);
      const nextDocument = this.parseDocument(html);
      const parsedMain = nextDocument.querySelector("#contenu");
      if (!parsedMain) throw new Error("La page reçue ne contient pas de zone principale");
      const nextMain = this.document.importNode(parsedMain, true);
      nextMain.setAttribute("data-claire-surface-page", declared.id);

      const replace = () => {
        this.document.querySelector("#contenu")?.replaceWith(nextMain);
        this.updateMetadata(nextDocument);
        this.updateCurrentNavigation(declared);
      };
      if (typeof this.document.startViewTransition === "function") {
        const transition = this.document.startViewTransition(replace);
        await transition.updateCallbackDone;
      } else {
        replace();
      }

      this.activePageId = declared.id;
      this.activeSectionId = null;
      this.navigationCount += 1;
      const href = this.hrefFor(declared);
      if (historyMode === "replace") {
        this.window.history.replaceState({ infoservClaire: true, pageId: declared.id }, "", href);
      } else if (historyMode === "push") {
        this.window.history.pushState({ infoservClaire: true, pageId: declared.id }, "", href);
      }

      this.document.dispatchEvent(new this.window.CustomEvent("infoserv:content-changed", {
        detail: { page: pageSummary(declared), navigationCount: this.navigationCount }
      }));
      const shouldScroll = scroll && !this.document.body.classList.contains("claire-is-guided");
      if (shouldScroll) {
        this.document.querySelector("#contenu")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
        await this.waitForPresentation();
      } else if (typeof this.window.requestAnimationFrame === "function") {
        await new Promise((resolve) => this.window.requestAnimationFrame(() => resolve()));
      }
      return pageSummary(declared);
    } finally {
      this.document.querySelector("#contenu")?.removeAttribute("aria-busy");
      this.document.body.classList.remove("claire-content-loading");
    }
  }

  async scrollTo(anchorId) {
    const target = this.document.getElementById(anchorId);
    if (!target || !this.document.querySelector("#contenu")?.contains(target)) {
      throw new Error("Section absente de la page affichée : " + anchorId);
    }
    this.activeSectionId = anchorId;
    const page = (this.knowledge.pages || []).find((item) => item.id === this.activePageId);
    if (page) {
      this.window.history.replaceState(
        { infoservClaire: true, pageId: page.id, anchorId },
        "",
        this.hrefFor(page, anchorId)
      );
    }
    target.classList.add("claire-target-highlight");
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView?.({ block: "start", behavior: "smooth" });
    target.focus?.({ preventScroll: true });
    this.window.setTimeout(() => target.classList.remove("claire-target-highlight"), 3600);
    await this.waitForPresentation();
    return { id: anchorId };
  }

  async waitForPresentation(timeoutMs = 720) {
    const win = this.window;
    if (!win) return;
    await new Promise((resolve) => {
      if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(() => resolve());
      else resolve();
    });
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = win.setTimeout(finish, timeoutMs);
      if (typeof win.addEventListener === "function") {
        win.addEventListener("scrollend", () => {
          win.clearTimeout?.(timer);
          finish();
        }, { once: true });
      }
    });
  }

  fillQuoteField(selector, value) {
    const field = this.document.querySelector(selector);
    if (!field || !value) return Boolean(field);
    if (field.tagName === "SELECT") {
      const needle = String(value).toLocaleLowerCase("fr");
      const option = [...field.options].find((item) => {
        const optionValue = item.value.toLocaleLowerCase("fr");
        const label = item.textContent.trim().toLocaleLowerCase("fr");
        return optionValue === needle || label.includes(needle);
      });
      if (option) field.value = option.value;
    } else {
      field.value = value;
    }
    return true;
  }

  prefillQuote(draft = {}) {
    const filled = {
      nameFound: this.fillQuoteField("#devis-name", draft.name),
      phoneFound: this.fillQuoteField("#devis-phone", draft.phone),
      emailFound: this.fillQuoteField("#devis-email", draft.email),
      cityFound: this.fillQuoteField("#devis-city", draft.city),
      serviceFound: this.fillQuoteField("#devis-service", draft.service),
      descriptionFound: this.fillQuoteField("#devis-description", draft.description)
    };
    return { ...filled, submitted: false };
  }

  quoteMissingFields() {
    return ["name", "phone", "email", "city", "service", "description"].filter((key) => {
      const field = this.document.querySelector(`#devis-${key}`);
      return !field || !String(field.value || "").trim();
    });
  }

  async submitQuote(draft = {}) {
    const formState = this.prefillQuote(draft);
    const form = this.document.querySelector("#devis-form");
    const missing = this.quoteMissingFields();
    if (!form || missing.length) {
      return { ...formState, submitted: false, sent: false, missing };
    }
    const payload = {
      kind: "devis",
      name: this.document.querySelector("#devis-name")?.value || draft.name || "",
      phone: this.document.querySelector("#devis-phone")?.value || draft.phone || "",
      email: this.document.querySelector("#devis-email")?.value || draft.email || "",
      city: this.document.querySelector("#devis-city")?.value || draft.city || "",
      service: this.document.querySelector("#devis-service")?.value || draft.service || "",
      description: this.document.querySelector("#devis-description")?.value || draft.description || "",
      website: this.document.querySelector("#devis-form [name='website']")?.value || ""
    };
    const result = await this.sendSiteEmail(payload);
    this.showFormStatus("#devis-form", result, "devis@infoserv2a.pro");
    return {
      ...formState,
      submitted: Boolean(result.sent),
      sent: Boolean(result.sent),
      pendingActivation: Boolean(result.pendingActivation),
      configured: result.configured,
      inbox: result.inbox,
      replyTo: result.replyTo,
      missing: result.missing || [],
      error: result.error || ""
    };
  }

  launchHref(href) {
    const target = String(href || "").trim();
    if (!target) return { href: "", launched: false };
    try {
      this.window.location.href = target;
      return { href: target, launched: true };
    } catch {
      return { href: target, launched: false };
    }
  }

  async sendSiteEmail(payload) {
    if (typeof this.window.InfoServ?.sendSiteEmail === "function") {
      return this.window.InfoServ.sendSiteEmail(payload);
    }
    const response = await this.fetchImpl("/api/send-email", {
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
      message: data.message || ""
    };
  }

  showFormStatus(selector, result, fallbackInbox) {
    const form = this.document.querySelector(selector);
    const api = this.window.InfoServ;
    if (!form || !api?.showStatus) return;
    if (result.pendingActivation) {
      api.showStatus(form, "ok", result.message || `Un e-mail d’activation arrive dans ${result.inbox || fallbackInbox}.`);
      return;
    }
    if (result.sent) {
      api.showStatus(form, "ok", `Message transmis vers ${result.inbox || fallbackInbox}.`);
      return;
    }
    api.showStatus(form, "error", result.error || "L’envoi n’a pas pu aboutir.");
  }

  prefillContact(draft = {}) {
    this.fillQuoteField("#contact-name", draft.name);
    this.fillQuoteField("#contact-email", draft.email || draft.replyTo);
    this.fillQuoteField("#contact-phone", draft.phone);
    this.fillQuoteField("#contact-message", draft.message || draft.body);
    return {
      name: this.document.querySelector("#contact-name")?.value || "",
      email: this.document.querySelector("#contact-email")?.value || "",
      phone: this.document.querySelector("#contact-phone")?.value || "",
      message: this.document.querySelector("#contact-message")?.value || ""
    };
  }

  async composeEmail(draft = {}) {
    const fields = this.prefillContact(draft);
    const missing = ["name", "email", "message"].filter((key) => !String(fields[key] || "").trim());
    if (missing.length) {
      return { sent: false, triggered: false, missing, inbox: "contact@infoserv2a.pro" };
    }
    const result = await this.sendSiteEmail({
      kind: "contact",
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      message: fields.message,
      website: this.document.querySelector("#contact-form [name='website']")?.value || ""
    });
    this.showFormStatus("#contact-form", result, "contact@infoserv2a.pro");
    return {
      ...result,
      draft,
      triggered: Boolean(result.sent),
      missing: result.missing || []
    };
  }

  snapshot() {
    return {
      activePage: this.activePageId,
      activeSection: this.activeSectionId,
      navigationCount: this.navigationCount,
      mainConnected: Boolean(this.document.querySelector("#contenu")?.isConnected)
    };
  }
}

export class InfoServ2ASiteAdapter {
  constructor({ knowledge, manifest, surface }) {
    if (!knowledge || !manifest || !surface) throw new Error("Adaptateur site InfoServ2A incomplet");
    this.knowledge = knowledge;
    this.manifest = manifest;
    this.surface = surface;
    this.toolNames = new Set((manifest.tools || []).map((tool) => tool.name));
    const initial = surface.snapshot?.() || {};
    this.view = {
      activePage: initial.activePage || null,
      activeSection: initial.activeSection || null,
      searchResults: [],
      contactChannel: null,
      quoteDraft: null,
      submitted: false
    };
  }

  pageById(id) {
    return (this.knowledge.pages || []).find((page) => page.id === id) || null;
  }

  prefetch(page) {
    return this.surface.prefetchPage?.(page) || false;
  }

  pageForHref(href) {
    const path = cleanPath(href);
    return (this.knowledge.pages || []).find((page) => cleanPath(page.href) === path) || null;
  }

  async execute(tool, args = {}) {
    if (!this.toolNames.has(tool)) throw new Error("Outil refusé par le manifeste : " + tool);
    switch (tool) {
      case "search_site": {
        const ranked = (this.knowledge.pages || [])
          .map((page) => ({ page, score: scorePage(args.query, page) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((entry) => ({ ...pageSummary(entry.page), score: entry.score }));
        this.view.searchResults = ranked;
        return { matches: clone(ranked) };
      }
      case "open_service": {
        const page = this.pageById(args.service);
        if (!page) throw new Error("Page non déclarée : " + args.service);
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        return { page: pageSummary(page), persistentSession: true };
      }
      case "scroll_to": {
        const page = this.pageById(this.view.activePage);
        const anchor = page?.anchors?.find((item) => item.id === args.target);
        if (!anchor) throw new Error("Section non déclarée sur la page active : " + args.target);
        await this.surface.scrollTo(anchor.id);
        this.view.activeSection = anchor.id;
        return { anchor: clone(anchor) };
      }
      case "open_contact": {
        const page = this.pageById("contact");
        if (!page) throw new Error("Page contact absente de l’index");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.contactChannel = ["call", "email", "form"].includes(args.channel) ? args.channel : "form";
        return { page: pageSummary(page), channel: this.view.contactChannel, triggered: false, persistentSession: true };
      }
      case "prefill_quote": {
        const page = this.pageById("quote");
        if (!page) throw new Error("Page devis absente de l’index");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.quoteDraft = quoteDraftFromArgs(args);
        const form = this.surface.prefillQuote(this.view.quoteDraft);
        this.view.submitted = false;
        return { page: pageSummary(page), draft: clone(this.view.quoteDraft), form, submitted: false, persistentSession: true };
      }
      case "submit_quote": {
        const page = this.pageById("quote");
        if (!page) throw new Error("Page devis absente de l’index");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.quoteDraft = quoteDraftFromArgs(args);
        const form = this.surface.submitQuote
          ? await this.surface.submitQuote(this.view.quoteDraft)
          : this.surface.prefillQuote(this.view.quoteDraft);
        this.view.submitted = Boolean(form.sent || form.submitted);
        return {
          page: pageSummary(page),
          draft: clone(this.view.quoteDraft),
          form,
          submitted: this.view.submitted,
          sent: Boolean(form.sent),
          pendingActivation: Boolean(form.pendingActivation),
          configured: form.configured,
          inbox: form.inbox || "devis@infoserv2a.pro",
          replyTo: form.replyTo || this.view.quoteDraft.email,
          missing: form.missing || [],
          error: form.error || "",
          persistentSession: true
        };
      }
      case "start_call": {
        const page = this.pageById("contact");
        if (!page) throw new Error("Page contact absente de l’index");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.contactChannel = "call";
        const href = String(args.href || "tel:+33745156076");
        const launched = this.surface.launchHref?.(href) || { href, launched: false };
        return {
          page: pageSummary(page),
          channel: "call",
          href,
          triggered: Boolean(launched.launched),
          persistentSession: true
        };
      }
      case "compose_email": {
        const page = this.pageById("contact");
        if (!page) throw new Error("Page contact absente de l’index");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.contactChannel = "email";
        const draft = {
          to: String(args.to || "contact@infoserv2a.pro"),
          subject: String(args.subject || "Contact InfoServ2A"),
          body: String(args.body || "")
        };
        const launched = this.surface.composeEmail
          ? await this.surface.composeEmail({
            ...draft,
            name: args.name,
            email: args.email,
            phone: args.phone,
            message: args.message || draft.body
          })
          : await this.surface.sendSiteEmail?.({
            kind: "contact",
            name: args.name,
            email: args.email,
            phone: args.phone,
            message: args.message || draft.body
          }) || { sent: false, configured: false };
        return {
          page: pageSummary(page),
          channel: "email",
          draft,
          sent: Boolean(launched.sent),
          pendingActivation: Boolean(launched.pendingActivation),
          configured: launched.configured,
          inbox: launched.inbox || draft.to,
          replyTo: launched.replyTo || args.email || "",
          missing: launched.missing || [],
          error: launched.error || "",
          triggered: Boolean(launched.sent),
          persistentSession: true
        };
      }
      case "list_catalog": {
        const pages = catalogEntries(this.knowledge);
        this.view.catalog = pages;
        return { pages: clone(pages), persistentSession: true };
      }
      case "explain_page": {
        const page = this.pageById(args.page) || this.pageById(this.view.activePage) || pageById(this.knowledge, "home");
        if (!page) throw new Error("Aucun onglet à expliquer");
        const section = page.anchors?.find((anchor) => anchor.id === this.view.activeSection) || null;
        return { page: pageSummary(page), section: section ? clone(section) : null, persistentSession: true };
      }
      case "go_home": {
        const page = this.pageById("home");
        if (!page) throw new Error("Onglet d’accueil absent de l’index");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        return { page: pageSummary(page), persistentSession: true };
      }
      case "next_page":
      case "prev_page": {
        const page = adjacentPage(this.knowledge, this.view.activePage || "home", tool === "next_page" ? 1 : -1);
        if (!page) throw new Error("Catalogue d’onglets vide");
        if (this.view.activePage !== page.id) await this.surface.openPage(page);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        return { page: pageSummary(page), persistentSession: true };
      }
      case "next_section":
      case "prev_section": {
        const page = this.pageById(this.view.activePage);
        const target = adjacentSection(page, this.view.activeSection, tool === "next_section" ? 1 : -1);
        if (!target) {
          return { page: page ? pageSummary(page) : null, anchor: null, atEnd: true, persistentSession: true };
        }
        await this.surface.scrollTo(target.id);
        this.view.activeSection = target.id;
        return { anchor: clone(target), persistentSession: true };
      }
      default:
        throw new Error("Outil non implémenté : " + tool);
    }
  }

  async navigateHref(href, { historyMode = "push", scroll = true } = {}) {
    const url = new URL(href, "https://infoserv2a.pro/");
    const page = this.pageForHref(url.href);
    if (!page) throw new Error("Lien hors de l’index InfoServ2A");
    if (this.view.activePage !== page.id || historyMode === "pop") {
      await this.surface.openPage(page, { historyMode: historyMode === "pop" ? "none" : historyMode, scroll });
    }
    this.view.activePage = page.id;
    this.view.activeSection = null;
    const anchorId = url.hash ? decodeURIComponent(url.hash.slice(1)) : null;
    if (anchorId) {
      const anchor = page.anchors?.find((item) => item.id === anchorId);
      if (!anchor) throw new Error("Section hors de l’index InfoServ2A");
      await this.surface.scrollTo(anchorId);
      this.view.activeSection = anchorId;
    }
    return this.snapshot();
  }

  async verify(plan) {
    if (!plan.expected) return { ok: true, reason: "Aucun changement de page attendu", persistentSession: true };
    const actual = this.surface.snapshot?.() || {};
    if (this.view.activePage !== plan.expected.pageId || actual.activePage !== plan.expected.pageId) {
      return { ok: false, reason: "La page attendue n’est pas active" };
    }
    if (plan.expected.anchorId && (this.view.activeSection !== plan.expected.anchorId || actual.activeSection !== plan.expected.anchorId)) {
      return { ok: false, reason: "La section attendue n’est pas active" };
    }
    return {
      ok: true,
      pageId: this.view.activePage,
      anchorId: this.view.activeSection,
      persistentSession: true
    };
  }

  snapshot() {
    const page = this.pageById(this.view.activePage);
    const section = page?.anchors?.find((anchor) => anchor.id === this.view.activeSection) || null;
    return clone({ ...this.view, page, section, surface: this.surface.snapshot?.() || null });
  }
}
