import { analyzeText, decodeBuffer } from "./analysisEngine.js";
import { buildPdf, copySummary, downloadBlob, safeFilename } from "./reportExports.js";

const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const delimiterOverride = document.querySelector("#delimiterOverride");
const fileMeta = document.querySelector("#fileMeta");
const fileError = document.querySelector("#fileError");
const previewSection = document.querySelector("#previewSection");
const previewTable = document.querySelector("#previewTable");
const columnsTable = document.querySelector("#columnsTable");
const detailsSection = document.querySelector("#detailsSection");
const resultPanel = document.querySelector("#resultPanel");
const languageButtons = document.querySelectorAll("[data-language-button]");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector("[data-menu-toggle]");
const headerMenu = document.querySelector("[data-header-menu]");

const LANGUAGES = new Set(["en", "pt", "es"]);
const HTML_LANG = {
  en: "en",
  pt: "pt-BR",
  es: "es-419"
};

import { TRANSLATIONS } from "../../shared/translations/file-validator.js";
import { ensureIdentity, renderIdentityBadge } from "../../shared/identity.js";

let currentLanguage = localStorage.getItem("calculatorLanguage") || "en";
let currentFile = null;
let currentText = "";
let currentEncoding = null;
let currentReport = null;

function t(key, values = {}) {
  const text = TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key;
  return Object.entries(values).reduce((memo, [name, value]) => memo.replaceAll(`{${name}}`, value), text);
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

function setLanguage(language) {
  if (!LANGUAGES.has(language)) return;
  currentLanguage = language;
  localStorage.setItem("calculatorLanguage", language);
  applyTranslations();
  clearError();

  if (currentFile && currentText && currentEncoding) {
    analyzeCurrentText();
  } else {
    renderEmptyResult();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(message) {
  fileError.textContent = message;
  fileError.hidden = false;
}

function clearError() {
  fileError.textContent = "";
  fileError.hidden = true;
}

function renderEmptyResult() {
  document.querySelector(".intro").style.display = "block";
  dropZone.style.display = "flex";
  resultPanel.className = "result-panel idle";
  resultPanel.innerHTML = "";
  previewSection.hidden = true;
  detailsSection.hidden = true;
}

function renderFileMeta(report) {
  fileMeta.hidden = false;
  fileMeta.innerHTML = `
    <div class="meta-chip"><span>${escapeHtml(t("file.name"))}</span><strong>${escapeHtml(report.file.name)}</strong></div>
    <div class="meta-chip"><span>${escapeHtml(t("metric.fileSize"))}</span><strong>${escapeHtml(report.file.sizeLabel)}</strong></div>
    <div class="meta-chip"><span>${escapeHtml(t("metric.delimiter"))}</span><strong>${escapeHtml(report.structure.delimiterLabel)}</strong></div>
    <div class="meta-chip"><span>${escapeHtml(t("metric.encoding"))}</span><strong>${escapeHtml(report.structure.encoding)}</strong></div>
  `;
}

function renderPreview(report) {
  previewSection.hidden = false;
  const headerLabels = Array.from({ length: report.structure.columns }, (_, index) => {
    const column = report.columns[index];
    return column ? column.name : `Column ${index + 1}`;
  });

  const head = `<thead><tr><th>#</th>${headerLabels.map((name) => `<th>${escapeHtml(name)}</th>`).join("")}</tr></thead>`;
  const body = report.previewRows
    .map(
      (row) => `
        <tr>
          <td>${row.lineNumber}</td>
          ${headerLabels.map((_, index) => `<td>${escapeHtml(row.cells[index] || "")}</td>`).join("")}
        </tr>
      `
    )
    .join("");

  previewTable.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function renderColumns(report) {
  detailsSection.hidden = false;
  const body = report.columns
    .map(
      (column) => `
        <tr>
          <td>${escapeHtml(column.name)}</td>
          <td>${escapeHtml(t(`type.${column.type}`))}</td>
          <td>${column.nulls}</td>
          <td>${column.uniqueValues}</td>
          <td>${escapeHtml(column.samples.join(", "))}</td>
        </tr>
      `
    )
    .join("");

  columnsTable.innerHTML = `
    <thead>
      <tr>
        <th>${escapeHtml(t("table.column"))}</th>
        <th>${escapeHtml(t("table.type"))}</th>
        <th>${escapeHtml(t("table.nulls"))}</th>
        <th>${escapeHtml(t("table.unique"))}</th>
        <th>${escapeHtml(t("table.samples"))}</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  `;
}

function renderIssues(report) {
  if (!report.issues.length) {
    return `<li class="issue info"><strong>${escapeHtml(t("result.noIssues"))}</strong></li>`;
  }

  return report.issues
    .map(
      (issue) => `
        <li class="issue ${escapeHtml(issue.severity)}">
          <span class="severity-badge ${escapeHtml(issue.severity)}">${escapeHtml(t(`severity.${issue.severity}`))}</span>
          <strong>${escapeHtml(issue.title)}</strong>
          <span>${escapeHtml(issue.detail)}</span>
        </li>
      `
    )
    .join("");
}

function renderReport(report) {
  renderFileMeta(report);
  renderPreview(report);
  renderColumns(report);

  document.querySelector(".intro").style.display = "none";
  dropZone.style.display = "none";

  const errors = report.issueCounts.error || 0;
  const warnings = report.issueCounts.warning || 0;
  let healthScore = 100;
  let severityClass = "clean";
  let statusText = "Clean Structure";

  if (errors > 0) {
    healthScore = 30;
    severityClass = "critical";
    statusText = "Errors Detected";
  } else if (warnings > 0) {
    healthScore = 70;
    severityClass = "medium";
    statusText = "Warnings Detected";
  }

  resultPanel.className = "result-panel";
  resultPanel.innerHTML = `
    <div class="score-card">
      <div>
        <span class="mono">${escapeHtml(t("result.kicker"))}</span>
        <h2>Flat File Structure &amp; Quality Report</h2>
      </div>

      <div class="report-header-card">
        <div class="score-meter ${escapeHtml(severityClass)}" style="--score: ${healthScore}">
          <span>${healthScore}%</span>
        </div>
        <div>
          <span class="risk-badge ${escapeHtml(severityClass)}">${escapeHtml(statusText)}</span>
          <p style="margin: 8px 0 0; font-size: 0.94rem; color: var(--text-muted); line-height: 1.5;">
            File Name: <strong>${escapeHtml(report.file.name)}</strong> (${escapeHtml(report.file.sizeLabel)}). 
            Detected structure: <strong>${report.structure.columns} columns</strong>, 
            <strong>${report.structure.rows} rows</strong>, with <strong>${escapeHtml(report.structure.delimiterLabel)}</strong> delimiter.
          </p>
        </div>
      </div>

      <div>
        <h3>${escapeHtml(t("result.summary"))}</h3>
        <div class="summary-grid">
          <div class="summary-metric"><span>${escapeHtml(t("metric.fileSize"))}</span><strong>${escapeHtml(report.file.sizeLabel)}</strong></div>
          <div class="summary-metric"><span>${escapeHtml(t("metric.rows"))}</span><strong>${report.structure.rows}</strong></div>
          <div class="summary-metric"><span>${escapeHtml(t("metric.columns"))}</span><strong>${report.structure.columns}</strong></div>
          <div class="summary-metric"><span>${escapeHtml(t("metric.delimiter"))}</span><strong>${escapeHtml(report.structure.delimiterLabel)}</strong></div>
          <div class="summary-metric"><span>${escapeHtml(t("metric.encoding"))}</span><strong>${escapeHtml(report.structure.encoding)}</strong></div>
          <div class="summary-metric"><span>${escapeHtml(t("metric.header"))}</span><strong>${escapeHtml(report.structure.headerDetected ? t("metric.yes") : t("metric.no"))}</strong></div>
        </div>
      </div>

      <div class="health-strip">
        <div class="health-item"><strong>${report.issueCounts.error}</strong><span>${escapeHtml(t("metric.errors"))}</span></div>
        <div class="health-item"><strong>${report.issueCounts.warning}</strong><span>${escapeHtml(t("metric.warnings"))}</span></div>
        <div class="health-item"><strong>${report.issueCounts.info}</strong><span>${escapeHtml(t("metric.info"))}</span></div>
      </div>

      <div>
        <h3>${escapeHtml(t("result.issues"))}</h3>
        <ul class="issues-list">${renderIssues(report)}</ul>
      </div>

      <div>
        <h3>${escapeHtml(t("result.exports"))}</h3>
        <div class="export-actions">
          <button type="button" data-export="json">${escapeHtml(t("result.downloadJson"))}</button>
          <button type="button" data-export="pdf">${escapeHtml(t("result.downloadPdf"))}</button>
          <button type="button" data-print-report class="print-button">Print Report</button>
          <button type="button" data-export="copy">${escapeHtml(t("result.copySummary"))}</button>
          <button type="button" data-reset-validator style="background: var(--surface); color: var(--text); border: 1px solid var(--rule-strong);">${escapeHtml(t("result.validateAnother"))}</button>
        </div>
      </div>

      <div class="cta">
        <h3>${escapeHtml(t("result.ctaTitle"))}</h3>
        <p>${escapeHtml(t("result.ctaText"))}</p>
        <div class="cta-actions">
          <a href="mailto:contact@veridatapro.com?subject=Flat%20file%20integration%20review">${escapeHtml(t("result.ctaButton"))}</a>
          <a href="https://veridatapro.com/" target="_blank" rel="noreferrer">veridatapro.com</a>
        </div>
      </div>
    </div>
  `;
}

function analyzeCurrentText() {
  try {
    clearError();
    const override = delimiterOverride.value || "auto";
    currentReport = analyzeText(currentFile, currentText, currentEncoding, override, t);
    delimiterOverride.disabled = false;
    renderReport(currentReport);
  } catch (error) {
    showError(error.message || t("errors.read"));
  }
}

async function handleFile(file) {
  if (!file) {
    showError(t("errors.noFile"));
    return;
  }

  // Capture the lead once, the first time they actually analyze a file.
  const contact = await ensureIdentity({ source: "file-validator", language: currentLanguage });
  if (!contact) return; // user dismissed the lead modal
  renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });

  try {
    clearError();
    currentFile = file;
    const buffer = await file.arrayBuffer();
    currentEncoding = decodeBuffer(buffer);
    currentText = currentEncoding.text;
    delimiterOverride.value = "auto";
    analyzeCurrentText();
  } catch (error) {
    showError(error.message || t("errors.read"));
  }
}

fileInput.addEventListener("change", () => {
  handleFile(fileInput.files[0]);
});

delimiterOverride.addEventListener("change", () => {
  if (currentFile && currentText) analyzeCurrentText();
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = event.dataTransfer.files[0];
  if (file) handleFile(file);
});

resultPanel.addEventListener("click", async (event) => {
  const resetButton = event.target.closest("[data-reset-validator]");
  if (resetButton) {
    currentFile = null;
    currentText = "";
    currentReport = null;
    renderEmptyResult();
    fileInput.value = "";
    return;
  }

  const printButton = event.target.closest("[data-print-report]");
  if (printButton) {
    window.print();
    return;
  }

  const button = event.target.closest("[data-export]");
  if (!button || !currentReport) return;
  const action = button.dataset.export;

  if (action === "json") {
    downloadBlob(safeFilename(currentReport.file.name, "json"), JSON.stringify(currentReport, null, 2), "application/json");
  }

  if (action === "pdf") {
    downloadBlob(safeFilename(currentReport.file.name, "pdf"), buildPdf(currentReport), "application/pdf");
  }

  if (action === "copy") {
    await copySummary(currentReport);
    button.textContent = t("result.copied");
    window.setTimeout(() => {
      button.textContent = t("result.copySummary");
    }, 1600);
  }
});

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

setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en");
// Show the badge if the visitor is already known on this device.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
