document.documentElement.classList.remove("no-js");

const mobileToggle = document.querySelector(".mobile-toggle");
const mainNav = document.querySelector(".main-nav");

function closeMenu() {
  if (!mobileToggle || !mainNav) return;
  mobileToggle.setAttribute("aria-expanded", "false");
  mainNav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
}

if (mobileToggle && mainNav) {
  mobileToggle.addEventListener("click", () => {
    const isOpen = mobileToggle.getAttribute("aria-expanded") === "true";
    mobileToggle.setAttribute("aria-expanded", String(!isOpen));
    mainNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("nav-open", !isOpen);
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
    { threshold: 0.14 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
