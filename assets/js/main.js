document.documentElement.classList.remove("no-js");

const header = document.querySelector("[data-header]");
const mobileToggle = document.querySelector(".mobile-toggle");
const mainNav = document.querySelector(".main-nav");

function closeMenu() {
  if (!mobileToggle || !mainNav) return;
  mobileToggle.setAttribute("aria-expanded", "false");
  mobileToggle.setAttribute("aria-label", "Ouvrir le menu");
  mainNav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
}

if (mobileToggle && mainNav) {
  mobileToggle.addEventListener("click", () => {
    const willOpen = mobileToggle.getAttribute("aria-expanded") !== "true";
    mobileToggle.setAttribute("aria-expanded", String(willOpen));
    mobileToggle.setAttribute("aria-label", willOpen ? "Fermer le menu" : "Ouvrir le menu");
    mainNav.classList.toggle("is-open", willOpen);
    document.body.classList.toggle("nav-open", willOpen);
  });

  mainNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function updateHeaderState() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 12);
}

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
