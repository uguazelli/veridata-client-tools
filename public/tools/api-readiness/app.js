const form = document.querySelector("#assessmentForm");
const resultPanel = document.querySelector("#resultPanel");
const formError = document.querySelector("#formError");
const preview = document.querySelector("#preview");
const submitButton = form.querySelector('button[type="submit"]');
const submitLabel = submitButton.querySelector("[data-submit-label]");
const languageButtons = document.querySelectorAll("[data-language-button]");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector("[data-menu-toggle]");
const headerMenu = document.querySelector("[data-header-menu]");
const progressBar = document.querySelector("#progressBar");
const progressLabel = document.querySelector("#progressLabel");
const progressTrack = document.querySelector("#progressTrack");
const TOTAL_QUESTIONS = 12;
const APP_BASE_PATH = window.APP_BASE_PATH || "";

const LANGUAGES = new Set(["en", "pt", "es"]);
const HTML_LANG = {
  en: "en",
  pt: "pt-BR",
  es: "es-419"
};

const CATEGORY_KEYS = ["systemComplexity", "manualWork", "dataReadiness", "apiReadiness", "operationalRisk"];

const ANSWER_FIELDS = [
  "systemsCount",
  "manualCopyFrequency",
  "spreadsheetDependency",
  "apiAvailability",
  "sourceOfTruth",
  "dataQuality",
  "reportingConsistency",
  "integrationReliability",
  "systemOwnership",
  "upcomingMigration",
  "biggestProblem"
];

import { TRANSLATIONS } from "../../shared/translations/api-readiness.js";
import { ensureIdentity, getContact, renderIdentityBadge } from "../../shared/identity.js";

let currentLanguage = localStorage.getItem("calculatorLanguage") || "en";
let lastResult = null;

function t(key, values = {}) {
  const text = TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key;
  return Object.entries(values).reduce((memo, [name, value]) => memo.replaceAll(`{${name}}`, value), text);
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
  return {
    language: currentLanguage,
    lead: {
      ...identityFields(),
      website: data.get("website"),
      companySize: data.get("companySize"),
      timeline: data.get("timeline")
    },
    answers: {
      systemsCount: data.get("systemsCount"),
      systemTypes: data.getAll("systemTypes"),
      manualCopyFrequency: data.get("manualCopyFrequency"),
      spreadsheetDependency: data.get("spreadsheetDependency"),
      apiAvailability: data.get("apiAvailability"),
      sourceOfTruth: data.get("sourceOfTruth"),
      dataQuality: data.get("dataQuality"),
      reportingConsistency: data.get("reportingConsistency"),
      integrationReliability: data.get("integrationReliability"),
      systemOwnership: data.get("systemOwnership"),
      upcomingMigration: data.get("upcomingMigration"),
      biggestProblem: data.get("biggestProblem")
    }
  };
}

function applyTranslations() {
  document.documentElement.lang = HTML_LANG[currentLanguage];
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]').setAttribute("content", t("meta.description"));

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmptyResult() {
  document.querySelector(".intro").style.display = "block";
  form.style.display = "block";
  resultPanel.className = "result-panel idle";
  resultPanel.innerHTML = "";
}

function renderCategoryScores(categoryScores) {
  return CATEGORY_KEYS.map((key) => {
    const value = Number(categoryScores[key] || 0);
    return `
      <div class="category-row">
        <span>${escapeHtml(t(`category.${key}`))}</span>
        <strong>${value}</strong>
        <div class="category-track" aria-hidden="true"><i style="--value: ${value}"></i></div>
      </div>
    `;
  }).join("");
}

function renderPainPoints(painPoints) {
  if (!painPoints.length) {
    return `<li>${escapeHtml(t("result.noPain"))}</li>`;
  }

  return painPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
}

function renderResult(result) {
  document.querySelector(".intro").style.display = "none";
  form.style.display = "none";
  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <div class="score-card">
      <div>
        <span class="mono">${escapeHtml(t("result.capturedKicker"))}</span>
        <h2>${escapeHtml(t("result.scoreHeading", { status: result.status }))}</h2>
      </div>

      <div class="report-header-card">
        <div class="score-meter ${escapeHtml(result.statusKey)}" style="--score: ${result.score}">
          <span>${result.score}</span>
        </div>
        <div>
          <span class="risk-badge ${escapeHtml(result.statusKey)}">${escapeHtml(result.status)}</span>
          <p style="margin: 8px 0 0; font-size: 0.94rem; color: var(--text-muted); line-height: 1.5;">
            ${escapeHtml(t("result.scoreHelp"))}
          </p>
        </div>
      </div>

      <div>
        <h3>${escapeHtml(t("result.painHeading"))}</h3>
        <ul class="pain-list">${renderPainPoints(result.painPoints)}</ul>
      </div>

      <div>
        <h3>${escapeHtml(t("result.categoryHeading"))}</h3>
        <div class="category-list">${renderCategoryScores(result.categoryScores)}</div>
      </div>

      <div>
        <h3>${escapeHtml(t("result.recommendationHeading"))}</h3>
        <div class="recommendation-box">${escapeHtml(result.recommendation)}</div>
      </div>

      <div class="cta">
        <h3>${escapeHtml(t("result.ctaTitle"))}</h3>
        <p>${escapeHtml(t("result.ctaText"))}</p>
        <div class="cta-actions">
          <a href="mailto:contact@veridatapro.com?subject=API%20readiness%20review">${escapeHtml(t("result.ctaMailLabel"))}</a>
          <button type="button" data-print-report class="print-button">Print / Export PDF</button>
          <a href="https://veridatapro.com/" target="_blank" rel="noreferrer">${escapeHtml(t("result.visitSite"))}</a>
        </div>
      </div>
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

function isAssessmentComplete() {
  const data = new FormData(form);
  return ANSWER_FIELDS.every((field) => String(data.get(field) || "").trim() !== "") && data.getAll("systemTypes").length > 0;
}

function updateProgress() {
  if (!progressBar || !progressLabel || !progressTrack) return;
  const data = new FormData(form);
  const answered =
    ANSWER_FIELDS.filter((f) => String(data.get(f) || "").trim() !== "").length +
    (data.getAll("systemTypes").length > 0 ? 1 : 0);
  const pct = Math.round((answered / TOTAL_QUESTIONS) * 100);
  progressBar.style.setProperty("--progress", pct + "%");
  progressTrack.setAttribute("aria-valuenow", answered);
  progressLabel.textContent = `${answered} / ${TOTAL_QUESTIONS}`;
}

function updatePreview() {
  updateProgress();
  preview.hidden = !isAssessmentComplete();
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

  if (new FormData(form).getAll("systemTypes").length === 0) {
    showError(t("errors.systemTypes"));
    return;
  }

  const contact = await ensureIdentity({ source: "api-readiness", language: currentLanguage });
  if (!contact) return; // user dismissed the lead modal
  renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });

  submitButton.disabled = true;
  submitLabel.textContent = t("form.calculating");

  try {
    const response = await fetch(`${APP_BASE_PATH}/api/assess`, {
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

    lastResult = { ...body.result, language: currentLanguage };
    renderResult(lastResult);
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

form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview);
form.addEventListener("submit", submitForm);
setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en", { resetResult: false });

// Badge shows only if the visitor is already known; the modal appears on demand
// when they submit for a result.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
