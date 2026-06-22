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
            <div class="teaser-line" style="width:60%"></div>
          </div>
        </div>
        <div class="teaser-bars">
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:72%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:44%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:63%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:55%"></div></div>
          <div class="teaser-bar-row"><div class="teaser-bar-label"></div><div class="teaser-bar-fill" style="width:38%"></div></div>
        </div>
      </div>
      <ul class="empty-list">
        <li>${escapeHtml(t("result.emptyScore"))}</li>
        <li>${escapeHtml(t("result.emptyPain"))}</li>
        <li>${escapeHtml(t("result.emptyNext"))}</li>
      </ul>
    </div>
  `;
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
  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <div class="score-card">
      <span class="mono">${escapeHtml(t("result.capturedKicker"))}</span>
      <h2>${escapeHtml(t("result.scoreHeading", { status: result.status }))}</h2>

      <div class="readiness-row">
        <div class="readiness-meter" style="--score: ${result.score}">
          <span>${result.score}</span>
        </div>
        <div>
          <span class="status-pill ${escapeHtml(result.statusKey)}">${escapeHtml(result.status)}</span>
          <p>${escapeHtml(t("result.scoreHelp"))}</p>
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

form.addEventListener("input", updatePreview);
form.addEventListener("change", updatePreview);
form.addEventListener("submit", submitForm);
setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en", { resetResult: false });

// Badge shows only if the visitor is already known; the modal appears on demand
// when they submit for a result.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
