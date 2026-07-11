const form = document.querySelector("#leadForm");
const resultPanel = document.querySelector("#resultPanel");
const formError = document.querySelector("#formError");
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
  // Ensure the intro and form cards are visible, and results are hidden
  document.querySelector(".intro").style.display = "block";
  form.style.display = "block";
  resultPanel.className = "result-panel idle";
  resultPanel.innerHTML = "";
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

  updateSliderValue();
}

function updateSliderValue() {
  if (utilizationValue && utilizationInput) {
    utilizationValue.value = utilizationInput.value;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderResult(result) {
  // Hide intro and form card to create a sequential, focused results view
  document.querySelector(".intro").style.display = "none";
  form.style.display = "none";

  const severityClass = result.risk.severity || "low";
  const signals = result.signals
    .map(
      (signal) => `<li><span><strong>${escapeHtml(signal.title)}</strong>: ${escapeHtml(signal.message)}</span></li>`
    )
    .join("");

  const recommendations = result.recommendations
    .map((rec) => `<li><span>${escapeHtml(rec)}</span></li>`)
    .join("");

  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <div class="score-card">
      <div>
        <span class="mono">${escapeHtml(t("result.capturedKicker"))}</span>
        <h2>MuleSoft Cost &amp; Utilization Assessment</h2>
      </div>

      <div class="report-header-card">
        <div class="score-meter ${escapeHtml(severityClass)}" style="--score: ${result.risk.score}">
          <span>${result.risk.score}</span>
        </div>
        <div>
          <span class="risk-badge ${escapeHtml(severityClass)}">${escapeHtml(result.risk.level)}</span>
          <p style="margin: 8px 0 0; font-size: 0.94rem; color: var(--text-muted); line-height: 1.5;">
            Score calculated from your allocated capacity, deployment topology, and average utilization of ${result.utilizationPct || result.waste.estimatedPercent || 0}%.
          </p>
        </div>
      </div>

      <div class="summary-card ${escapeHtml(severityClass)}">
        <div class="summary-card-header">
          <strong>${result.waste.estimatedPercent}%</strong>
          <span>Estimated capacity waste</span>
        </div>
        <p style="margin: 0 0 16px; font-size: 0.94rem; color: var(--text-muted); line-height: 1.5;">
          ${escapeHtml(result.waste.message)}
        </p>
        <ul class="summary-details">
          <li>
            <span>Deployment model</span>
            <span>${escapeHtml(result.footprint.deploymentModel)}</span>
          </li>
          <li>
            <span>Commercial model</span>
            <span>${escapeHtml(result.footprint.commercialModel)}</span>
          </li>
          <li>
            <span>Renewal timeline</span>
            <span>${escapeHtml(result.footprint.renewalTimeline)}</span>
          </li>
          <li>
            <span>Total capacity</span>
            <span>${escapeHtml(t("result.totalCores", { count: result.footprint.totalCores }))}</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 style="font-size: 1.1rem; margin: 0 0 10px; color: var(--ink);">${escapeHtml(t("result.signalsHeading"))}</h3>
        <ul class="clean-list">${signals}</ul>
      </div>

      <div>
        <h3 style="font-size: 1.1rem; margin: 0 0 10px; color: var(--ink);">${escapeHtml(t("result.recommendationsHeading"))}</h3>
        <ul class="clean-list recommendations">${recommendations}</ul>
      </div>

      <div class="cta">
        <h3>${escapeHtml(result.cta.headline)}</h3>
        <p>${escapeHtml(result.cta.message)}</p>
        <div class="cta-actions">
          <a href="mailto:contact@veridatapro.com?subject=MuleSoft%20optimization%20audit">${escapeHtml(t("result.auditMailLabel"))}</a>
          <button type="button" data-print-report class="print-button">Print / Export PDF</button>
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

resultPanel.addEventListener("click", (event) => {
  const printButton = event.target.closest("[data-print-report]");
  if (printButton) {
    window.print();
  }
});

form.addEventListener("input", updateSliderValue);
form.addEventListener("change", updateSliderValue);
form.addEventListener("submit", submitForm);
setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en", { resetResult: false });

// Show the badge only if we already know the visitor; the modal itself now
// appears on demand when they submit for a result.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
