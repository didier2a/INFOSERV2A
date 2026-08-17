(function () {
  const toggle = document.querySelectorAll(".nav-toggle");
  const panel = document.querySelector(".nav-panel");
  const overlay = document.querySelector(".nav-overlay");
  const closeBtn = document.querySelector(".nav-panel__close");
  const navItems = document.querySelectorAll(".nav-item");
  const desktopNav = window.matchMedia("(min-width: 900px)");

  navItems.forEach((navItem) => {
    const subToggle = navItem.querySelector(".nav-sub-toggle");
    if (!subToggle) return;
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
  });

  if (!panel || !overlay || !toggle.length) return;

  const menuButton = document.querySelector(".header-inner .nav-toggle");
  const focusable = () => panel.querySelectorAll("a, button, summary, [tabindex]:not([tabindex='-1'])");

  const open = () => {
    panel.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.classList.add("nav-open");
    toggle.forEach((btn) => btn.setAttribute("aria-expanded", "true"));
    const first = focusable()[0];
    if (first) first.focus();
  };

  const close = () => {
    panel.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    toggle.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
    if (menuButton) menuButton.focus();
  };

  toggle.forEach((btn) => {
    btn.addEventListener("click", () => {
      panel.classList.contains("is-open") ? close() : open();
    });
  });
  overlay.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (panel.classList.contains("is-open")) close();
      navItems.forEach((navItem) => {
        navItem.classList.remove("is-open");
        const subToggle = navItem.querySelector(".nav-sub-toggle");
        if (subToggle) subToggle.setAttribute("aria-expanded", "false");
      });
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
