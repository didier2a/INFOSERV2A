import { adjacentPage, adjacentSection, catalogEntries, pageById, scorePage } from "./claire-core.mjs?v=20260903-it27";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class InfoServ2ALabAdapter {
  constructor({ knowledge, manifest }) {
    this.knowledge = knowledge;
    this.manifest = manifest;
    this.toolNames = new Set((manifest.tools || []).map((tool) => tool.name));
    this.view = {
      activePage: null,
      activeSection: null,
      searchResults: [],
      contactChannel: null,
      quoteDraft: null,
      submitted: false
    };
  }

  pageById(id) {
    return (this.knowledge.pages || []).find((page) => page.id === id) || null;
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
          .map((entry) => ({ id: entry.page.id, title: entry.page.title, href: entry.page.href, score: entry.score }));
        this.view.searchResults = ranked;
        return { matches: clone(ranked) };
      }
      case "open_service": {
        const page = this.pageById(args.service);
        if (!page) throw new Error("Page non déclarée : " + args.service);
        this.view.activePage = page.id;
        this.view.activeSection = null;
        return { page: { id: page.id, title: page.title, href: page.href, summary: page.summary } };
      }
      case "scroll_to": {
        const page = this.pageById(this.view.activePage);
        const anchor = page?.anchors?.find((item) => item.id === args.target);
        if (!anchor) throw new Error("Section non déclarée sur la page active : " + args.target);
        this.view.activeSection = anchor.id;
        return { anchor: clone(anchor) };
      }
      case "open_contact": {
        const page = this.pageById("contact");
        if (!page) throw new Error("Page contact absente de l’index");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.contactChannel = ["call", "email", "form"].includes(args.channel) ? args.channel : "form";
        return { page: { id: page.id, title: page.title, href: page.href }, channel: this.view.contactChannel, triggered: false };
      }
      case "prefill_quote": {
        const page = this.pageById("quote");
        if (!page) throw new Error("Page devis absente de l’index");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.quoteDraft = {
          name: String(args.name || "").slice(0, 80),
          phone: String(args.phone || "").slice(0, 40),
          email: String(args.email || "").slice(0, 120),
          city: String(args.city || "").slice(0, 80),
          service: String(args.service || "").slice(0, 80),
          description: String(args.description || "").slice(0, 500)
        };
        this.view.submitted = false;
        const missing = ["name", "phone", "email", "city", "service", "description"]
          .filter((key) => !this.view.quoteDraft[key]);
        return {
          page: { id: page.id, title: page.title, href: page.href },
          draft: clone(this.view.quoteDraft),
          submitted: false,
          sent: false,
          missing
        };
      }
      case "submit_quote": {
        const page = this.pageById("quote");
        if (!page) throw new Error("Page devis absente de l’index");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.quoteDraft = {
          name: String(args.name || "").slice(0, 80),
          phone: String(args.phone || "").slice(0, 40),
          email: String(args.email || "").slice(0, 120),
          city: String(args.city || "").slice(0, 80),
          service: String(args.service || "").slice(0, 80),
          description: String(args.description || "").slice(0, 500)
        };
        const missing = ["name", "phone", "email", "city", "service", "description"]
          .filter((key) => !this.view.quoteDraft[key]);
        this.view.submitted = missing.length === 0;
        return {
          page: { id: page.id, title: page.title, href: page.href },
          draft: clone(this.view.quoteDraft),
          submitted: this.view.submitted,
          sent: this.view.submitted,
          inbox: "contact@infoserv2a.pro",
          replyTo: this.view.quoteDraft.email,
          missing
        };
      }
      case "start_call": {
        const page = this.pageById("contact");
        if (!page) throw new Error("Page contact absente de l’index");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.contactChannel = "call";
        this.view.lastLaunch = { type: "call", href: String(args.href || "tel:+33745156076") };
        return {
          page: { id: page.id, title: page.title, href: page.href },
          channel: "call",
          href: this.view.lastLaunch.href,
          triggered: true
        };
      }
      case "compose_email": {
        const page = this.pageById("contact");
        if (!page) throw new Error("Page contact absente de l’index");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        this.view.contactChannel = "email";
        this.view.lastLaunch = {
          type: "email",
          to: String(args.to || "contact@infoserv2a.pro"),
          subject: String(args.subject || "Contact InfoServ2A"),
          body: String(args.body || "")
        };
        return {
          page: { id: page.id, title: page.title, href: page.href },
          channel: "email",
          draft: clone(this.view.lastLaunch),
          sent: true,
          inbox: this.view.lastLaunch.to,
          replyTo: args.email || "",
          triggered: true
        };
      }
      case "list_catalog": {
        const pages = catalogEntries(this.knowledge);
        this.view.catalog = pages;
        return { pages: clone(pages) };
      }
      case "explain_page": {
        const page = this.pageById(args.page) || this.pageById(this.view.activePage) || pageById(this.knowledge, "home");
        if (!page) throw new Error("Aucun onglet à expliquer");
        const section = page.anchors?.find((anchor) => anchor.id === this.view.activeSection) || null;
        return { page: { id: page.id, title: page.title, href: page.href, summary: page.summary }, section: section ? clone(section) : null };
      }
      case "go_home": {
        const page = this.pageById("home");
        if (!page) throw new Error("Onglet d’accueil absent de l’index");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        return { page: { id: page.id, title: page.title, href: page.href, summary: page.summary } };
      }
      case "next_page":
      case "prev_page": {
        const page = adjacentPage(this.knowledge, this.view.activePage || "home", tool === "next_page" ? 1 : -1);
        if (!page) throw new Error("Catalogue d’onglets vide");
        this.view.activePage = page.id;
        this.view.activeSection = null;
        return { page: { id: page.id, title: page.title, href: page.href, summary: page.summary } };
      }
      case "next_section":
      case "prev_section": {
        const page = this.pageById(this.view.activePage);
        const target = adjacentSection(page, this.view.activeSection, tool === "next_section" ? 1 : -1);
        if (!target) return { page: page ? { id: page.id, title: page.title } : null, anchor: null, atEnd: true };
        this.view.activeSection = target.id;
        return { anchor: clone(target) };
      }
      default:
        throw new Error("Outil non implémenté : " + tool);
    }
  }

  async verify(plan) {
    if (!plan.expected) return { ok: true, reason: "Aucun changement de page attendu" };
    if (this.view.activePage !== plan.expected.pageId) {
      return { ok: false, reason: "La page attendue n’est pas active" };
    }
    if (plan.expected.anchorId && this.view.activeSection !== plan.expected.anchorId) {
      return { ok: false, reason: "La section attendue n’est pas active" };
    }
    return {
      ok: true,
      pageId: this.view.activePage,
      anchorId: this.view.activeSection
    };
  }

  snapshot() {
    const page = this.pageById(this.view.activePage);
    const section = page?.anchors?.find((anchor) => anchor.id === this.view.activeSection) || null;
    return clone({ ...this.view, page, section });
  }
}
