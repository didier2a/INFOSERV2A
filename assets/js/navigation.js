(function () {
  const toggle = document.querySelector(".nav-toggle");
  const panel = document.querySelector(".nav-panel");
  const overlay = document.querySelector(".nav-overlay");
  const closeBtn = document.querySelector(".nav-panel__close");
  const subToggle = document.querySelector(".nav-sub-toggle");
  const navItem = document.querySelector(".nav-item");

  if (subToggle && navItem) {
    const desktopNav = window.matchMedia("(min-width: 900px)");
    const setSubOpen = (open) => {
      navItem.classList.toggle("is-open", open);
      subToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    navItem.addEventListener("mouseenter", () => {
      if (!desktopNav.matches) return;
      setSubOpen(true);
    });
    navItem.addEventListener("mouseleave", () => {
      if (!desktopNav.matches) return;
      setSubOpen(false);
    });
    subToggle.addEventListener("click", () => {
      setSubOpen(!navItem.classList.contains("is-open"));
    });
    document.addEventListener("click", (event) => {
      if (!navItem.contains(event.target)) setSubOpen(false);
    });
  }

  if (!toggle || !panel || !overlay) return;

  const focusable = () => panel.querySelectorAll("a, button, [tabindex]:not([tabindex='-1'])");

  const open = () => {
    panel.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    const first = focusable()[0];
    if (first) first.focus();
  };

  const close = () => {
    panel.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  };

  toggle.addEventListener("click", () => {
    panel.classList.contains("is-open") ? close() : open();
  });
  overlay.addEventListener("click", close);
  if (closeBtn) closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (panel.classList.contains("is-open")) close();
      if (navItem) {
        navItem.classList.remove("is-open");
        if (subToggle) subToggle.setAttribute("aria-expanded", "false");
      }
    }
    if (event.key !== "Tab" || !panel.classList.contains("is-open")) return;
    const nodes = [...focusable()];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
