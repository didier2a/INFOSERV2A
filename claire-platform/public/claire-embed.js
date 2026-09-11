(function claireEmbedLoader(global, document) {
  "use strict";

  function dispatch(name, detail) {
    if (typeof global.CustomEvent === "function") {
      global.dispatchEvent(new global.CustomEvent(name, { detail }));
    }
  }

  async function mountClaireEmbed(script) {
    if (!script || script.dataset.claireMounted === "true") return null;
    const tenant = String(script.dataset.tenant || "").trim();
    if (!tenant) throw new Error("Claire embed: data-tenant is required.");

    const scriptUrl = new URL(script.src, global.location.href);
    const platformOrigin = scriptUrl.origin;
    const hostOrigin = global.location.origin;
    const declaredOrigin = String(script.dataset.origin || "").trim();
    if (declaredOrigin && declaredOrigin !== hostOrigin) {
      throw new Error("Claire embed: data-origin does not match the current page origin.");
    }

    const bootstrapUrl = new URL("/api/embed/bootstrap", platformOrigin);
    bootstrapUrl.searchParams.set("tenant", tenant);
    const response = await global.fetch(bootstrapUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "application/json" }
    });
    const bootstrap = await response.json().catch(function () { return {}; });
    if (!response.ok || !bootstrap.embedTicket) {
      throw new Error(bootstrap.error || "Claire embed bootstrap failed.");
    }

    const iframe = document.createElement("iframe");
    const frameUrl = new URL("/embed/", platformOrigin);
    frameUrl.searchParams.set("tenant", tenant);
    frameUrl.hash = "ticket=" + encodeURIComponent(bootstrap.embedTicket);
    iframe.src = frameUrl.href;
    iframe.title = (bootstrap.tenant && bootstrap.tenant.persona && bootstrap.tenant.persona.name) || "Claire";
    iframe.loading = "eager";
    iframe.allow = "microphone; autoplay";
    iframe.referrerPolicy = "no-referrer";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
    iframe.dataset.claireTenant = tenant;
    iframe.style.cssText = [
      "position:fixed",
      "right:max(12px,env(safe-area-inset-right))",
      "bottom:max(12px,env(safe-area-inset-bottom))",
      "width:min(400px,calc(100vw - 24px))",
      "height:min(680px,calc(100dvh - 24px))",
      "border:0",
      "border-radius:24px",
      "z-index:2147483000",
      "background:transparent",
      "box-shadow:0 24px 80px rgba(15,23,42,.28)"
    ].join(";");

    const target = script.dataset.target ? document.querySelector(script.dataset.target) : document.body;
    if (!target) throw new Error("Claire embed: target element was not found.");
    target.appendChild(iframe);
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.textContent = iframe.title;
    launcher.hidden = true;
    launcher.setAttribute("aria-label", "Ouvrir Claire");
    launcher.style.cssText = [
      "position:fixed",
      "right:max(16px,env(safe-area-inset-right))",
      "bottom:max(16px,env(safe-area-inset-bottom))",
      "width:64px",
      "height:64px",
      "border:0",
      "border-radius:50%",
      "z-index:2147483000",
      "color:white",
      "background:#174f52",
      "font:700 12px system-ui,sans-serif",
      "box-shadow:0 12px 36px rgba(15,23,42,.3)",
      "cursor:pointer"
    ].join(";");
    launcher.addEventListener("click", function () {
      iframe.hidden = false;
      launcher.hidden = true;
    });
    target.appendChild(launcher);
    script.dataset.claireMounted = "true";

    global.addEventListener("message", function (event) {
      if (event.origin !== platformOrigin || event.source !== iframe.contentWindow) return;
      if (event.data && event.data.type === "claire:close") {
        iframe.hidden = true;
        launcher.hidden = false;
      }
      if (event.data && event.data.type === "claire:open") {
        iframe.hidden = false;
        launcher.hidden = true;
      }
    });
    dispatch("claire:mounted", { tenant: tenant, iframe: iframe });
    return iframe;
  }

  global.ClaireEmbed = Object.freeze({ mount: mountClaireEmbed });
  const current = document.currentScript;
  if (current) {
    Promise.resolve().then(function () { return mountClaireEmbed(current); }).catch(function (error) {
      console.error(error);
      dispatch("claire:error", { message: error.message });
    });
  }
})(window, document);
