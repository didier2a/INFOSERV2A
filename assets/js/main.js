(function () {
  const skipParents = "script, style, noscript, textarea, .brand-name";
  const brandPattern = /InfoServ2A|INFOSERV2A/g;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !/InfoServ2A|INFOSERV2A/.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (node.parentElement && node.parentElement.closest(skipParents)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    const parts = node.nodeValue.split(brandPattern);
    if (parts.length < 2) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (part) frag.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) {
        const mark = document.createElement("span");
        mark.className = "brand-name";
        mark.textContent = "INFOSERV2A";
        frag.appendChild(mark);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });

  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const initFaq = (root = document) => {
    root.querySelectorAll?.(".faq details").forEach((item) => {
      if (item.dataset.infoservBound === "true") return;
      const summary = item.querySelector("summary");
      if (!summary) return;
      item.dataset.infoservBound = "true";
      const sync = () => summary.setAttribute("aria-expanded", item.open ? "true" : "false");
      sync();
      item.addEventListener("toggle", sync);
    });
  };
  initFaq();
  document.addEventListener("infoserv:content-changed", () => initFaq(document.querySelector("#contenu")));

  window.InfoServ = {
    maxFiles: 5,
    maxFileSize: 8 * 1024 * 1024,
    accepted: [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".txt"],
    isLocal: ["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.startsWith("192.168."),
    emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phonePattern: /^[0-9 +().-]{8,20}$/,
    setError(field, message) {
      const holder = field.closest(".form-field")?.querySelector(".field-error");
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (holder) holder.textContent = message || "";
    },
    showStatus(form, type, message) {
      const box = form.querySelector(".form-status");
      if (!box) return;
      box.className = "form-status is-visible form-status--" + type;
      box.textContent = message;
    },
    required(field, label) {
      if (!field.value.trim()) {
        this.setError(field, "Veuillez renseigner " + label + ".");
        return false;
      }
      this.setError(field, "");
      return true;
    },
    sendSiteEmail(payload) {
      return fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload || {})
      }).then(async (response) => {
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
      });
    }
  };
})();
