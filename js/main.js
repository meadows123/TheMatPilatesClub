// Header: go solid once the page scrolls past the hero
const header = document.querySelector(".site-header");
if (header && !header.classList.contains("site-header--solid")) {
  const onScroll = () => header.classList.toggle("is-solid", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

// Mobile nav
const toggle = document.querySelector(".nav-toggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
  });
  document.querySelectorAll(".nav a").forEach((link) =>
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

// Fade sections in as they scroll into view
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

// Pre-select the pass on the contact form from ?pass=... links
const passSelect = document.querySelector("#pass");
const passParam = new URLSearchParams(window.location.search).get("pass");
if (passSelect && passParam) passSelect.value = passParam;

// Contact form — placeholder handler until a real form service is connected
const form = document.querySelector(".contact-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.classList.add("is-sent");
    form.reset();
  });
}

// Footer year
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
