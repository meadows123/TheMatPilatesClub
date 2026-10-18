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

// Contact form — emails enquiries via Web3Forms (access key set on the form in contact.html).
// Without a key it falls back to opening the visitor's email app, so no enquiry is lost.
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  const errorEl = contactForm.querySelector(".form__error");
  const submitBtn = contactForm.querySelector('button[type="submit"]');

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (contactForm.botcheck.checked) return; // spam trap

    const name = contactForm.name.value.trim();
    const email = contactForm.email.value.trim();
    const interest = contactForm.pass.selectedOptions[0].textContent;
    const message = contactForm.message.value.trim();
    const subject = `Website enquiry: ${interest}`;
    const accessKey = contactForm.dataset.accessKey;

    errorEl.classList.remove("is-shown");

    if (!accessKey) {
      const body = `Name: ${name}\nEmail: ${email}\nInterested in: ${interest}\n\n${message}`;
      window.location.href = `mailto:${contactForm.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject,
          from_name: "The Mat Pilates Club website",
          name,
          email,
          replyto: email,
          "Interested in": interest,
          message,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      contactForm.classList.add("is-sent");
      contactForm.reset();
    } catch (err) {
      console.error(err);
      errorEl.innerHTML = `Sorry, your message couldn't be sent. Please email <a href="mailto:${contactForm.dataset.to}">${contactForm.dataset.to}</a> or message us on Instagram.`;
      errorEl.classList.add("is-shown");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });
}

// Welcome offer pop-up — shown once per visitor, a moment after arriving
const PROMO_CODE = "WELCOME10";

function showPromo() {
  const promo = document.createElement("div");
  promo.className = "modal promo";
  promo.setAttribute("aria-hidden", "true");
  promo.innerHTML = `
    <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <button class="modal__close" data-close aria-label="Close">&times;</button>
      <span class="promo__kicker">New to our classes?</span>
      <div class="promo__big">10% off</div>
      <h2 id="promo-title" style="font-size: 1.8rem;">any introduction pack</h2>
      <p>Discover what makes us different from other Bristol Pilates classes.</p>
      <button class="btn btn--primary promo__reveal">Get 10% Code</button>
      <div class="promo__code">
        <code>${PROMO_CODE}</code>
        <button class="btn btn--outline promo__copy">Copy</button>
      </div>
      <a class="btn btn--primary promo__book" href="https://bookwhen.com/thematpilatesclub" hidden>Book an Intro Pack</a>
      <p class="promo__small">Enter the code at checkout.</p>
      <p class="promo__small"><button class="link-btn" data-close>No thanks</button></p>
    </div>`;
  document.body.appendChild(promo);

  const close = () => promo.classList.remove("is-open");
  promo.addEventListener("click", (e) => {
    if (e.target === promo || e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());

  promo.querySelector(".promo__reveal").addEventListener("click", () => {
    promo.classList.add("is-revealed");
    promo.querySelector(".promo__book").hidden = false;
  });

  promo.querySelector(".promo__copy").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      e.target.textContent = "Copied!";
    } catch {
      e.target.textContent = "Select & copy";
    }
  });

  requestAnimationFrame(() => {
    promo.classList.add("is-open");
    promo.setAttribute("aria-hidden", "false");
  });
}

if (!document.body.hasAttribute("data-no-promo")) {
  let seen = false;
  try {
    seen = localStorage.getItem("mpc-promo-seen") === "1";
  } catch {}
  // ?promo in the URL shows it again (handy for testing)
  if (!seen || new URLSearchParams(window.location.search).has("promo"))
    setTimeout(() => {
      try {
        localStorage.setItem("mpc-promo-seen", "1");
      } catch {}
      showPromo();
    }, 2500);
}

// Links like classes.html#faq-cancellation open that FAQ answer
function openLinkedFaq() {
  const target = window.location.hash && document.querySelector(window.location.hash);
  if (target && target.tagName === "DETAILS") {
    target.open = true;
    target.scrollIntoView({ block: "center" });
  }
}
openLinkedFaq();
window.addEventListener("hashchange", openLinkedFaq);

// Footer year
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
