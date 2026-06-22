import { IDENTITY_TRANSLATIONS } from "./translations/identity.js";

const STORAGE_KEY = "veridataContact";
const CLIENT_ID_KEY = "veridataClientId";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function t(language, key) {
  const lang = IDENTITY_TRANSLATIONS[language] ? language : "en";
  return IDENTITY_TRANSLATIONS[lang][key] || IDENTITY_TRANSLATIONS.en[key] || key;
}

function contactApiUrl() {
  // The contact endpoint is mounted once at the app root, independent of each
  // tool's base path.
  const base = (window.APP_BASE_PATH || "").replace(/\/[^/]*$/, "");
  return `${base}/api/contact`;
}

export function getContact() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && parsed.fullName) return parsed;
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function resetIdentity() {
  localStorage.removeItem(STORAGE_KEY);
}

function saveContact(contact) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
}

function buildModal(language) {
  const overlay = document.createElement("div");
  overlay.className = "identity-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="identity-card" role="document">
      <button type="button" class="identity-close" aria-label="${t(language, "close")}">&times;</button>
      <h2 class="identity-title">${t(language, "title")}</h2>
      <p class="identity-intro">${t(language, "intro")}</p>
      <form class="identity-form" novalidate>
        <label class="identity-field">
          <span>${t(language, "name")}</span>
          <input name="fullName" autocomplete="name" placeholder="${t(language, "namePlaceholder")}" required />
        </label>
        <label class="identity-field">
          <span>${t(language, "email")}</span>
          <input name="email" type="email" autocomplete="email" placeholder="${t(language, "emailPlaceholder")}" required />
        </label>
        <label class="identity-field">
          <span>${t(language, "company")}</span>
          <input name="company" autocomplete="organization" placeholder="${t(language, "companyPlaceholder")}" required />
        </label>
        <p class="identity-error" role="alert" hidden></p>
        <button class="identity-submit" type="submit">${t(language, "submit")}</button>
        <p class="identity-privacy">${t(language, "privacy")}</p>
      </form>
    </div>
  `;
  return overlay;
}

// Resolves with the stored contact. If we already know the visitor it resolves
// immediately (no modal). Otherwise it shows the registration modal on demand and
// resolves once they register — or resolves `null` if they dismiss it. Call this
// at the moment a tool is about to reveal its result.
export function ensureIdentity({ source = "", language = "en" } = {}) {
  return new Promise((resolve) => {
    const existing = getContact();
    if (existing) {
      resolve(existing);
      return;
    }

    const overlay = buildModal(language);
    const form = overlay.querySelector(".identity-form");
    const errorEl = overlay.querySelector(".identity-error");
    const submit = overlay.querySelector(".identity-submit");

    let settled = false;
    function dismiss() {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      document.body.classList.remove("identity-locked");
      resolve(null);
    }
    function onKeydown(event) {
      if (event.key === "Escape") dismiss();
    }

    overlay.querySelector(".identity-close").addEventListener("click", dismiss);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) dismiss();
    });
    document.addEventListener("keydown", onKeydown);

    document.body.appendChild(overlay);
    document.body.classList.add("identity-locked");
    form.querySelector('input[name="fullName"]').focus();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorEl.hidden = true;

      const data = new FormData(form);
      const contact = {
        fullName: String(data.get("fullName") || "").trim(),
        email: String(data.get("email") || "").trim().toLowerCase(),
        company: String(data.get("company") || "").trim(),
        clientId: getClientId(),
        language,
        source
      };

      if (!contact.fullName || !EMAIL_PATTERN.test(contact.email) || !contact.company) {
        errorEl.textContent = t(language, "error");
        errorEl.hidden = false;
        return;
      }

      submit.disabled = true;
      submit.textContent = t(language, "submitting");

      try {
        const response = await fetch(contactApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contact)
        });
        if (!response.ok) throw new Error("contact save failed");
      } catch {
        // Persist locally even if the network call fails so the user isn't
        // blocked; the lead is best-effort.
        errorEl.textContent = t(language, "networkError");
        errorEl.hidden = false;
        submit.disabled = false;
        submit.textContent = t(language, "submit");
        return;
      }

      saveContact(contact);
      settled = true;
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      document.body.classList.remove("identity-locked");
      resolve(contact);
    });
  });
}

// Renders a small "Signed in as … · Not you?" badge into the given container.
// Clicking "Not you?" clears identity and reloads so the modal reappears.
export function renderIdentityBadge(container, { language = "en" } = {}) {
  const contact = getContact();
  if (!container || !contact) return;

  container.innerHTML = "";
  const badge = document.createElement("div");
  badge.className = "identity-badge";
  badge.innerHTML = `
    <span class="identity-badge-text">${t(language, "badgePrefix")} <strong></strong></span>
    <button type="button" class="identity-badge-reset">${t(language, "notYou")}</button>
  `;
  badge.querySelector("strong").textContent = `${contact.fullName} · ${contact.company}`;
  badge.querySelector(".identity-badge-reset").addEventListener("click", () => {
    resetIdentity();
    window.location.reload();
  });
  container.appendChild(badge);
}
