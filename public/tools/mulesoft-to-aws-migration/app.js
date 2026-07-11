const form = document.querySelector("#calculatorForm");
const resultPanel = document.querySelector("#resultPanel");
const formError = document.querySelector("#formError");
const submitButton = form.querySelector('button[type="submit"]');
const submitLabel = submitButton.querySelector("[data-submit-label]");
const languageButtons = document.querySelectorAll("[data-language-button]");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector("[data-menu-toggle]");
const headerMenu = document.querySelector("[data-header-menu]");
const APP_BASE_PATH = window.APP_BASE_PATH || "";

const LANGUAGES = new Set(["en", "pt", "es"]);
const HTML_LANG = {
  en: "en",
  pt: "pt-BR",
  es: "es-419"
};

import { TRANSLATIONS } from "../../shared/translations/mulesoft-to-aws-migration.js";
import { ensureIdentity, getContact, renderIdentityBadge } from "../../shared/identity.js";

let currentLanguage = localStorage.getItem("calculatorLanguage") || "en";
let lastDownload = null;

function t(key, values = {}) {
  const text = TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key;
  return Object.entries(values).reduce((memo, [name, value]) => memo.replaceAll(`{${name}}`, value), text);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function identityFields() {
  const contact = getContact() || {};
  return {
    fullName: contact.fullName || "",
    email: contact.email || "",
    company: contact.company || "",
    clientId: contact.clientId || ""
  };
}

function getPayload() {
  const data = new FormData(form);
  const targetAwsServices = data.getAll("targetAwsServices");
  return {
    language: currentLanguage,
    ...identityFields(),
    role: data.get("role"),
    website: data.get("website"),
    companySize: data.get("companySize"),
    primaryChallenge: data.get("primaryChallenge"),
    timeline: data.get("timeline"),
    muleApplications: parseInt(data.get("muleApplications") || "0", 10),
    targetAwsServices: targetAwsServices
  };
}

function applyTranslations() {
  document.documentElement.lang = HTML_LANG[currentLanguage];
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  languageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === currentLanguage));
  });

  syncMenuLabel();
}

function isMenuOpen() {
  return menuToggle?.getAttribute("aria-expanded") === "true";
}

function syncMenuLabel() {
  if (!menuToggle) return;
  menuToggle.setAttribute("aria-label", t(isMenuOpen() ? "menu.close" : "menu.open"));
}

function setMenuOpen(open) {
  if (!menuToggle || !siteHeader) return;
  menuToggle.setAttribute("aria-expanded", String(open));
  siteHeader.classList.toggle("menu-open", open);
  syncMenuLabel();
}

function renderEmptyResult() {
  resultPanel.className = "result-panel idle";
  resultPanel.innerHTML = `
    <div class="result-empty">
      <span class="mono">${escapeHtml(t("result.emptyKicker"))}</span>
      <h2>${escapeHtml(t("result.emptyTitle"))}</h2>
      <p>${escapeHtml(t("result.emptyText"))}</p>
      <div class="result-teaser" aria-hidden="true">
        <div class="teaser-score-row">
          <div class="teaser-meter"><div class="teaser-meter-inner">?</div></div>
          <div class="teaser-lines">
            <div class="teaser-pill"></div>
            <div class="teaser-line"></div>
            <div class="teaser-line" style="width:65%"></div>
          </div>
        </div>
        <div class="teaser-bars">
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:68%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:52%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:79%"></div></div>
        </div>
      </div>
      <ul class="document-list">
        <li>${escapeHtml(t("result.itemOne"))}</li>
        <li>${escapeHtml(t("result.itemTwo"))}</li>
        <li>${escapeHtml(t("result.itemThree"))}</li>
      </ul>
    </div>
  `;
}

function renderReadyResult(download) {
  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <div class="score-card">
      <span class="mono">${escapeHtml(t("result.readyKicker"))}</span>
      <h2>${escapeHtml(t("result.readyTitle"))}</h2>

      <div class="document-summary">
        <strong>${escapeHtml(t("result.summaryTitle"))}</strong>
        <p>${escapeHtml(t("result.summaryText"))}</p>
      </div>

      <div class="download-card">
        <strong>${escapeHtml(t("result.downloadTitle"))}</strong>
        <span>${escapeHtml(t("result.downloadText"))}</span>
        <a href="${escapeHtml(download.url)}" download="${escapeHtml(download.fileName)}">${escapeHtml(t("result.downloadButton"))}</a>
      </div>

      <div class="cta">
        <h3>${escapeHtml(t("result.ctaTitle"))}</h3>
        <p>${escapeHtml(t("result.ctaText"))}</p>
        <div class="cta-actions">
          <a href="mailto:contact@veridatapro.com?subject=MuleSoft%20to%20AWS%20migration%20review">${escapeHtml(t("result.ctaMailLabel"))}</a>
          <a href="https://veridatapro.com/" target="_blank" rel="noreferrer">${escapeHtml(t("result.visitSite"))}</a>
        </div>
      </div>
    </div>
  `;
}

function setLanguage(language) {
  if (!LANGUAGES.has(language)) return;
  currentLanguage = language;
  localStorage.setItem("calculatorLanguage", language);
  applyTranslations();
  clearError();

  if (lastDownload) {
    renderReadyResult(lastDownload);
  } else {
    renderEmptyResult();
  }
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = "";
  formError.hidden = true;
}

async function submitForm(event) {
  event.preventDefault();
  clearError();

  if (!form.checkValidity()) {
    form.reportValidity();
    showError(t("errors.completeRequired"));
    return;
  }

  const contact = await ensureIdentity({ source: "mulesoft-aws-migration", language: currentLanguage });
  if (!contact) return; // user dismissed the lead modal
  renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });

  submitButton.disabled = true;
  submitLabel.textContent = t("form.loading");

  try {
    const response = await fetch(`${APP_BASE_PATH}/api/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(getPayload())
    });

    const body = await response.json();

    if (!response.ok) {
      const fieldErrors = body.fields ? Object.values(body.fields).join(" ") : body.error;
      throw new Error(fieldErrors || t("errors.unable"));
    }

    lastDownload = body.download;
    renderReadyResult(lastDownload);
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(error.message || t("errors.unable"));
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = t("form.submit");
  }
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
    setMenuOpen(false);
  });
});

menuToggle?.addEventListener("click", () => {
  setMenuOpen(!isMenuOpen());
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});

document.addEventListener("click", (event) => {
  if (!isMenuOpen()) return;
  if (siteHeader.contains(event.target)) {
    if (event.target.closest("[data-menu-toggle]")) return;
    if (event.target.closest("[data-header-menu]")) return;
  }
  setMenuOpen(false);
});

headerMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});

form.addEventListener("submit", submitForm);
setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en");

// Badge shows only if the visitor is already known; the modal appears on demand
// when they submit for the download.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
