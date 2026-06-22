const form = document.querySelector("#leadForm");
const resultPanel = document.querySelector("#resultPanel");
const formError = document.querySelector("#formError");
const preview = document.querySelector("#preview");
const utilizationInput = document.querySelector('input[name="utilizationPct"]');
const utilizationValue = document.querySelector("#utilizationValue");
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

import { TRANSLATIONS } from "../../shared/translations/mulesoft-calculator.js";
import { ensureIdentity, getContact, renderIdentityBadge } from "../../shared/identity.js";

const footprintFields = [
  "deploymentModel",
  "commercialModel",
  "productionCores",
  "sandboxCores",
  "runningApplications",
  "managedApis",
  "renewalTimeline"
];

let currentLanguage = localStorage.getItem("calculatorLanguage") || "en";
let lastResult = null;

function t(key, values = {}) {
  const text = TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key;
  return Object.entries(values).reduce((memo, [name, value]) => memo.replaceAll(`{${name}}`, value), text);
}

function getPayload() {
  const data = new FormData(form);
  return {
    language: currentLanguage,
    deploymentModel: data.get("deploymentModel"),
    commercialModel: data.get("commercialModel"),
    productionCores: data.get("productionCores"),
    sandboxCores: data.get("sandboxCores"),
    runningApplications: data.get("runningApplications"),
    utilizationPct: data.get("utilizationPct"),
    managedApis: data.get("managedApis"),
    addons: data.getAll("addons"),
    renewalTimeline: data.get("renewalTimeline"),
    ...identityFields()
  };
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

function applyTranslations() {
  document.documentElement.lang = HTML_LANG[currentLanguage];
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  languageButtons.forEach((button) => {
    const isActive = button.dataset.lang === currentLanguage;
    button.setAttribute("aria-pressed", String(isActive));
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
            <div class="teaser-line" style="width:55%"></div>
          </div>
        </div>
        <div class="teaser-bars">
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:38%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:61%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:50%"></div></div>
        </div>
      </div>
      <ul class="empty-list">
        <li>${escapeHtml(t("result.emptyRisk"))}</li>
        <li>${escapeHtml(t("result.emptyWaste"))}</li>
        <li>${escapeHtml(t("result.emptyNext"))}</li>
      </ul>
    </div>
  `;
}

function setLanguage(language, { resetResult = true } = {}) {
  if (!LANGUAGES.has(language)) return;

  currentLanguage = language;
  localStorage.setItem("calculatorLanguage", language);
  applyTranslations();
  clearError();

  if (resetResult && lastResult && lastResult.language !== currentLanguage) {
    lastResult = null;
  }

  if (lastResult) {
    renderResult(lastResult);
  } else {
    renderEmptyResult();
  }

  updatePreview();
}

function updatePreview() {
  utilizationValue.value = utilizationInput.value;
  const data = new FormData(form);
  const footprintComplete = footprintFields.every((field) => data.get(field) !== "");
  preview.hidden = !footprintComplete;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = "";
  formError.hidden = true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderResult(result) {
  const severityClass = result.risk.severity;
  const signals = result.signals
    .map(
      (signal) => `
        <li class="signal ${escapeHtml(signal.severity)}">
          <strong>${escapeHtml(signal.title)}</strong>
          <p>${escapeHtml(signal.message)}</p>
        </li>
      `
    )
    .join("");

  const recommendations = result.recommendations
    .map((recommendation) => `<li>${escapeHtml(recommendation)}</li>`)
    .join("");

  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <div class="score-card">
      <span class="mono">${escapeHtml(t("result.capturedKicker"))}</span>
      <h2>${escapeHtml(t("result.utilizationRisk", { level: result.risk.level }))}</h2>

      <div class="risk-row">
        <div class="risk-meter" style="--score: ${result.risk.score}">
          <span>${result.risk.score}</span>
        </div>
        <div>
          <span class="risk-pill ${escapeHtml(severityClass)}">${escapeHtml(result.risk.level)}</span>
          <p>${escapeHtml(result.disclaimer)}</p>
        </div>
      </div>

      <div class="waste-box">
        <strong>${result.waste.estimatedPercent}%</strong>
        <p>${escapeHtml(result.waste.message)}</p>
      </div>

      <div class="waste-box">
        <strong>${escapeHtml(result.footprint.deploymentModel)}</strong>
        <p>
          ${escapeHtml(result.footprint.commercialModel)} · ${escapeHtml(result.footprint.renewalTimeline)}
          · ${escapeHtml(t("result.totalCores", { count: result.footprint.totalCores }))}
        </p>
      </div>

      <div>
        <h3>${escapeHtml(t("result.signalsHeading"))}</h3>
        <ul class="signal-list">${signals}</ul>
      </div>

      <div>
        <h3>${escapeHtml(t("result.recommendationsHeading"))}</h3>
        <ul class="recommendations">${recommendations}</ul>
      </div>

      <div class="cta">
        <h3>${escapeHtml(result.cta.headline)}</h3>
        <p>${escapeHtml(result.cta.message)}</p>
        <div class="cta-actions">
          <a href="mailto:contact@veridatapro.com?subject=MuleSoft%20optimization%20audit">${escapeHtml(t("result.auditMailLabel"))}</a>
          <a href="https://veridatapro.com/" target="_blank" rel="noreferrer">${escapeHtml(t("result.visitSite"))}</a>
        </div>
      </div>
    </div>
  `;
}

async function submitForm(event) {
  event.preventDefault();
  clearError();

  if (!form.checkValidity()) {
    form.reportValidity();
    showError(t("errors.completeRequired"));
    return;
  }

  const contact = await ensureIdentity({ source: "mulesoft-calculator", language: currentLanguage });
  if (!contact) return; // user dismissed the lead modal
  renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });

  submitButton.disabled = true;
  submitLabel.textContent = t("form.calculating");

  try {
    const response = await fetch(`${APP_BASE_PATH}/api/calculate`, {
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

    lastResult = body.result;
    renderResult(body.result);
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
  if (event.key === "Escape") {
    setMenuOpen(false);
  }
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

form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview);
form.addEventListener("submit", submitForm);
setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en", { resetResult: false });

// Show the badge only if we already know the visitor; the modal itself now
// appears on demand when they submit for a result.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
