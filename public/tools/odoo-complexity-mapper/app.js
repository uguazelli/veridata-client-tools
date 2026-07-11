const systemGroupsRoot = document.querySelector("#systemGroups");
const moduleGroupsRoot = document.querySelector("#moduleGroups");
const mapperAlert = document.querySelector("#mapperAlert");
const systemCount = document.querySelector("[data-system-count]");
const moduleCount = document.querySelector("[data-module-count]");
const customSystemInput = document.querySelector("#customSystemInput");
const stackMap = document.querySelector("#stackMap");
const diagramWrap = document.querySelector("#diagramWrap");
const mapTooltip = document.querySelector("#mapTooltip");
const scopeSummary = document.querySelector("#scopeSummary");
const complexityTableBody = document.querySelector("#complexityTableBody");
const priorityList = document.querySelector("#priorityList");
const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector("[data-menu-toggle]");
const headerMenu = document.querySelector("[data-header-menu]");
const languageButtons = document.querySelectorAll("[data-language-button]");
const exportPdfButton = document.querySelector("[data-export-pdf]");

const LANGUAGES = new Set(["en", "pt", "es"]);
const HTML_LANG = {
  en: "en",
  pt: "pt-BR",
  es: "es-419"
};

import { TRANSLATIONS, DATA } from "../../shared/translations/odoo-complexity-mapper.js";
import { ensureIdentity, renderIdentityBadge } from "../../shared/identity.js";

const { SYSTEM_GROUPS, MODULE_GROUPS, SYSTEM_ALIASES, SYSTEM_COPY, MODULE_LABELS, MODULE_TOKEN_LABELS, CATEGORY_LABEL_KEYS, MODULE_GROUP_LABEL_KEYS, COMPLEXITY_MATRIX, MODULE_MATCHES } = DATA;

const selectedSystems = new Set();
const selectedModules = new Set();
const customSystems = [];
let currentStep = 1;
let currentRows = [];
let currentLanguage = localStorage.getItem("odooMapperLanguage") || "en";

function t(key, values = {}) {
  const text = TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS.en[key] || key;
  return Object.entries(values).reduce((memo, [name, value]) => memo.replaceAll(`{${name}}`, value), text);
}

function applyTranslations() {
  document.documentElement.lang = HTML_LANG[currentLanguage];
  document.title = t("meta.title");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("meta.description"));

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });

  languageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === currentLanguage));
  });

  syncMenuLabel();
}

function setLanguage(language, { resetResult = false } = {}) {
  if (!LANGUAGES.has(language)) return;

  currentLanguage = language;
  localStorage.setItem("odooMapperLanguage", language);
  applyTranslations();
  renderSystemGroups();
  renderModuleGroups();

  if (currentRows.length && !resetResult) {
    currentRows = buildRows();
    renderScopeSummary(currentRows);
    renderStackMap(currentRows);
    renderComplexityTable(currentRows);
    renderPriorityList(currentRows);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function getLanguageCopy(copy = {}) {
  if (currentLanguage === "en") return copy.en;
  return copy[currentLanguage] || copy.en;
}

function getLookupName(systemName) {
  return SYSTEM_ALIASES[systemName] || systemName;
}

function getSystemCopy(systemName) {
  return SYSTEM_COPY[systemName] || SYSTEM_COPY[getLookupName(systemName)] || null;
}

function getSystemLabel(systemName) {
  const copy = getSystemCopy(systemName);
  return getLanguageCopy(copy?.label) || systemName;
}

function getSystemNote(systemName, entry) {
  const copy = getSystemCopy(systemName);
  return getLanguageCopy(copy?.note) || entry.note || t("note.requiresAssessment");
}

function getModuleLabel(moduleName) {
  return getLanguageCopy(MODULE_LABELS[moduleName]) || moduleName;
}

function getModuleTokenLabel(moduleName) {
  return getLanguageCopy(MODULE_TOKEN_LABELS[moduleName]) || moduleName;
}

function getMatrixEntry(systemName) {
  return (
    COMPLEXITY_MATRIX[systemName] ||
    COMPLEXITY_MATRIX[getLookupName(systemName)] || {
      modules: "Any",
      complexity: "Unknown",
      note: t("note.requiresAssessment")
    }
  );
}

function getComplexityClass(complexity) {
  return String(complexity || "Unknown").toLowerCase();
}

function getDisplayRating(systemName, entry) {
  if (entry.complexity === "Unknown") return "Unknown / needs assessment";
  if (entry.complexity !== "High") return entry.complexity;

  if (hasCustomBuildSignal(`${systemName} ${entry.note}`)) {
    return "Custom build required";
  }

  return "High";
}

function requiresCustomConversation(row) {
  return row.entry?.complexity === "High" || row.complexity === "High" || row.entry?.complexity === "Unknown" || row.complexity === "Unknown";
}

function hasCustomBuildSignal(text) {
  return /custom|middleware|no api|api audit|assessment|enterprise integration|etl|migration|required/i.test(text);
}

function getRadioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function selectedModuleIntersects(matrixModules) {
  if (matrixModules === "Any") return selectedModules.size > 0;

  return matrixModules.split("/").some((part) => {
    const key = part.trim();
    const exact = MODULE_MATCHES[key] || [key];
    return exact.some((moduleName) => selectedModules.has(moduleName));
  });
}

function getKnownSystems() {
  return SYSTEM_GROUPS.flatMap((group) => group.systems);
}

function getOptimalColumns(count) {
  if (count <= 4) return count;
  for (const cols of [4, 3, 5, 6]) {
    if (count % cols === 0) return cols;
  }
  return 4;
}

function renderSystemGroups() {
  const groups = customSystems.length
    ? [...SYSTEM_GROUPS, { name: "Added systems", systems: customSystems }]
    : SYSTEM_GROUPS;

  systemGroupsRoot.innerHTML = groups
    .map((group) => {
      const cols = getOptimalColumns(group.systems.length);
      return `
        <section class="choice-category" aria-label="${escapeHtml(getGroupLabel(group.name))}">
          <h3 class="category-title">${escapeHtml(getGroupLabel(group.name))}</h3>
          <div class="choice-grid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr))">
            ${group.systems.map((system) => renderSelectorCard(system, selectedSystems.has(system), "", "system", null)).join("")}
          </div>
        </section>
      `;
    })
    .join("");

  updateCounts();
}

function renderModuleGroups() {
  moduleGroupsRoot.innerHTML = MODULE_GROUPS.map((group) => {
    const cols = getOptimalColumns(group.modules.length);
    return `
      <section class="choice-category" aria-label="${escapeHtml(getModuleGroupLabel(group.name))}">
        <h3 class="category-title">${escapeHtml(getModuleGroupLabel(group.name))}</h3>
        <div class="choice-grid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr))">
          ${group.modules.map((moduleName) => renderSelectorCard(moduleName, selectedModules.has(moduleName), "", "module", null)).join("")}
        </div>
      </section>
    `;
  }).join("");

  updateCounts();
}

function renderSelectorCard(label, selected, meta, type, complexityClass) {
  const dataAttr = type === "system" ? "data-system" : "data-module";
  const displayLabel = type === "system" ? getSystemLabel(label) : getModuleLabel(label);
  const badge = complexityClass
    ? `<span class="card-badge ${escapeHtml(complexityClass)}">${escapeHtml(meta)}</span>`
    : "";

  return `
    <button class="selector-card" type="button" ${dataAttr}="${escapeHtml(label)}" aria-pressed="${selected}">
      <span class="card-check" aria-hidden="true"></span>
      <span class="card-title">${escapeHtml(displayLabel)}</span>
      ${badge}
    </button>
  `;
}

function getSystemMeta(systemName) {
  const entry = getMatrixEntry(systemName);
  if (entry.complexity === "Unknown") return t("complexity.unknownShort");
  return getComplexityLabel(entry.complexity);
}

function getSystemComplexityClass(systemName) {
  return getComplexityClass(getMatrixEntry(systemName).complexity);
}

function updateCounts() {
  systemCount.textContent = t("selected.count", { count: selectedSystems.size });
  moduleCount.textContent = t("selected.count", { count: selectedModules.size });
}

function getGroupLabel(groupName) {
  return t(CATEGORY_LABEL_KEYS[groupName] || groupName);
}

function getModuleGroupLabel(groupName) {
  return t(MODULE_GROUP_LABEL_KEYS[groupName] || groupName);
}

function getComplexityLabel(complexity) {
  return t(`complexity.${String(complexity).toLowerCase()}`);
}

function clearAlert() {
  mapperAlert.textContent = "";
  mapperAlert.hidden = true;
}

function showAlert(message) {
  mapperAlert.textContent = message;
  mapperAlert.hidden = false;
  mapperAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setStep(step) {
  currentStep = step;
  clearAlert();
  document.querySelectorAll("[data-step-panel]").forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== step;
  });
  document.querySelectorAll("[data-step-token]").forEach((token) => {
    token.classList.toggle("is-active", Number(token.dataset.stepToken) === step);
  });

  const intro = document.querySelector(".intro");
  if (intro) {
    intro.style.display = (step === 3) ? "none" : "block";
  }
}

function validateStepOne() {
  if (!selectedSystems.size) {
    showAlert(t("errors.noSystems"));
    return false;
  }
  return true;
}

function validateStepTwo() {
  if (!selectedModules.size) {
    showAlert(t("errors.noModules"));
    return false;
  }

  if (!getRadioValue("odooStage")) {
    showAlert(t("errors.noStage"));
    return false;
  }

  if (!getRadioValue("dataVolume")) {
    showAlert(t("errors.noVolume"));
    return false;
  }

  return true;
}

function buildRows() {
  return Array.from(selectedSystems).map((systemName) => {
    const entry = getMatrixEntry(systemName);
    const complexity = entry.complexity;

    return {
      systemName,
      displayName: getSystemLabel(systemName),
      entry,
      modules: entry.modules,
      complexity,
      complexityClass: getComplexityClass(complexity),
      rating: getDisplayRating(systemName, entry),
      note: getSystemNote(systemName, entry),
      affectsSelectedModules: selectedModuleIntersects(entry.modules)
    };
  });
}

async function generateResults() {
  if (!validateStepTwo()) return;

  // Capture the lead once, the first time they generate the result.
  const contact = await ensureIdentity({ source: "odoo-complexity-mapper", language: currentLanguage });
  if (!contact) return; // user dismissed the lead modal
  renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });

  currentRows = buildRows();
  renderScopeSummary(currentRows);
  renderStackMap(currentRows);
  renderComplexityTable(currentRows);
  renderPriorityList(currentRows);
  setStep(3);
  document.querySelector("#results-title").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderScopeSummary(rows) {
  const highCount = rows.filter((row) => row.complexity === "High").length;
  const unknownCount = rows.filter((row) => row.complexity === "Unknown").length;
  const mediumCount = rows.filter((row) => row.complexity === "Medium").length;
  const lowCount = rows.filter((row) => row.complexity === "Low").length;
  const postureKey =
    unknownCount > 0
      ? "posture.audit"
      : highCount > mediumCount + lowCount
        ? "posture.custom"
        : highCount > 0
          ? "posture.highRisk"
          : mediumCount > 0
            ? "posture.config"
            : "posture.low";

  let complexityScore = 95;
  let severityClass = "low";
  if (postureKey === "posture.config") {
    complexityScore = 60;
    severityClass = "medium";
  } else if (postureKey !== "posture.low") {
    complexityScore = 25;
    severityClass = "critical";
  }

  const headerCard = document.querySelector("#resultsHeaderCard");
  if (headerCard) {
    headerCard.innerHTML = `
      <div class="report-header-card">
        <div class="score-meter ${escapeHtml(severityClass)}" style="--score: ${complexityScore}">
          <span>${complexityScore}%</span>
        </div>
        <div>
          <span class="risk-badge ${escapeHtml(severityClass)}">${escapeHtml(t(postureKey))}</span>
          <p style="margin: 8px 0 0; font-size: 0.94rem; color: var(--text-muted); line-height: 1.5;">
            Complexity score determined from <strong>${rows.length} systems</strong> connected to Odoo across <strong>${selectedModules.size} core modules</strong>.
          </p>
        </div>
      </div>
    `;
  }

  scopeSummary.innerHTML = `
    <div class="scope-card">
      <span>${escapeHtml(t("summary.systems"))}</span>
      <strong>${rows.length}</strong>
      <p>${escapeHtml(formatPreviewList(rows.map((row) => row.displayName)))}</p>
    </div>
    <div class="scope-card">
      <span>${escapeHtml(t("summary.footprint"))}</span>
      <strong>${escapeHtml(t("summary.modules", { count: selectedModules.size }))}</strong>
      <p>${escapeHtml(formatPreviewList(Array.from(selectedModules).map(getModuleLabel)))}</p>
    </div>
    <div class="scope-card">
      <span>${escapeHtml(t("summary.risk"))}</span>
      <strong>${escapeHtml(t(postureKey))}</strong>
      <p>${escapeHtml(t("summary.riskText", { high: highCount, unknown: unknownCount, medium: mediumCount, low: lowCount }))}</p>
    </div>
    <div class="scope-card">
      <span>${escapeHtml(t("summary.context"))}</span>
      <strong>${escapeHtml(getStageLabel())}</strong>
      <p>${escapeHtml(getVolumeLabel())}</p>
    </div>
  `;
}

function formatPreviewList(items) {
  if (!items.length) return t("selected.none");
  if (items.length <= 2) return items.join(", ");
  return t("selected.more", { items: items.slice(0, 2).join(", "), count: items.length - 2 });
}

function getStageLabel(value = getRadioValue("odooStage")) {
  return value ? t(`stage.${value}`) : "";
}

function getVolumeLabel(value = getRadioValue("dataVolume")) {
  return value ? t(`volume.${value}`) : "";
}

function renderStackMap(rows) {
  const count = rows.length || 1;
  const maxRadiusY = count > 16 ? 242 : count > 8 ? 224 : 196;
  const pad = 52; // space above top node + below bottom node
  const centerY = maxRadiusY + pad;
  const svgHeight = centerY * 2;
  const center = { x: 450, y: centerY };
  const nodeWidth = 172;
  const nodeHeight = 72;
  const lines = [];
  const nodes = [];

  rows.forEach((row, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    const outer = count > 16 && index % 2 === 1;
    const radiusX = count > 16 ? (outer ? 330 : 246) : count > 8 ? 306 : 256;
    const radiusY = count > 16 ? (outer ? 242 : 180) : count > 8 ? 224 : 196;
    const x = center.x + Math.cos(angle) * radiusX;
    const y = center.y + Math.sin(angle) * radiusY;
    const lineEndX = center.x + Math.cos(angle) * (radiusX - nodeWidth * 0.35);
    const lineEndY = center.y + Math.sin(angle) * (radiusY - nodeHeight * 0.35);
    const labelLines = wrapSvgLabel(row.displayName);
    const labelStartY = y - labelLines.length * 8 - 2;

    lines.push(`
      <line
        class="map-line ${escapeHtml(row.complexityClass)}"
        x1="${center.x}"
        y1="${center.y}"
        x2="${lineEndX.toFixed(1)}"
        y2="${lineEndY.toFixed(1)}"
      />
    `);

    nodes.push(`
      <g
        class="map-node ${escapeHtml(row.complexityClass)}"
        data-system="${escapeHtml(row.systemName)}"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(`${row.displayName} ${t("tooltip.complexity")}`)}"
      >
        <rect x="${(x - nodeWidth / 2).toFixed(1)}" y="${(y - nodeHeight / 2).toFixed(1)}" width="${nodeWidth}" height="${nodeHeight}" rx="8"></rect>
        <text x="${x.toFixed(1)}" y="${labelStartY.toFixed(1)}">
          ${labelLines.map((line, lineIndex) => `<tspan x="${x.toFixed(1)}" dy="${lineIndex === 0 ? 0 : 14}">${escapeHtml(line)}</tspan>`).join("")}
        </text>
        <text class="node-rating" x="${x.toFixed(1)}" y="${(y + 27).toFixed(1)}">${escapeHtml(getComplexityShortLabel(row.complexity))}</text>
      </g>
    `);
  });

  const odooY = center.y;
  stackMap.setAttribute("viewBox", `0 0 900 ${svgHeight}`);
  stackMap.style.height = `${Math.round(svgHeight * 0.965)}px`;
  stackMap.innerHTML = `
    <g class="map-lines">${lines.join("")}</g>
    <g class="map-nodes">${nodes.join("")}</g>
    <g class="odoo-node" aria-label="Odoo center node">
      <rect x="${center.x - 100}" y="${odooY - 40}" width="200" height="80" rx="8"></rect>
      <text x="${center.x}" y="${odooY - 3}">Odoo</text>
      <text class="odoo-subtext" x="${center.x}" y="${odooY + 19}">${escapeHtml(t("map.center"))}</text>
    </g>
  `;

  hideTooltip();
}

function wrapSvgLabel(label) {
  const words = String(label).split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > 20 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);

  if (lines.length > 3) {
    const compact = lines.slice(0, 2);
    compact.push(`${lines.slice(2).join(" ").slice(0, 18)}...`);
    return compact;
  }

  return lines;
}

function getComplexityShortLabel(complexity) {
  if (complexity === "Unknown") return t("complexity.unknownShort");
  return getComplexityLabel(complexity);
}

function renderComplexityTable(rows) {
  complexityTableBody.innerHTML = rows
    .map((row) => {
      const ratingClass = getRatingClass(row);
      const scopeSuffix = row.affectsSelectedModules ? "" : t("table.outsideScope");

      return `
        <tr>
          <td data-label="${escapeHtml(t("table.system"))}">${escapeHtml(row.displayName)}</td>
          <td data-label="${escapeHtml(t("table.modules"))}">${escapeHtml(formatAffectedModules(row.modules))}</td>
          <td data-label="${escapeHtml(t("table.rating"))}"><span class="rating-pill ${escapeHtml(ratingClass)}">${escapeHtml(formatRating(row))}</span></td>
          <td data-label="${escapeHtml(t("table.note"))}">${escapeHtml(row.note + scopeSuffix)}</td>
        </tr>
      `;
    })
    .join("");
}

function formatAffectedModules(modules) {
  if (modules === "Any") return t("table.anyModule");
  return modules
    .split("/")
    .map((moduleName) => getModuleTokenLabel(moduleName.trim()))
    .join(" / ");
}

function formatRating(row) {
  if (row.rating === "Custom build required") return t("rating.customBuild");
  if (row.complexity === "Unknown") return t("complexity.unknown");
  return getComplexityLabel(row.complexity);
}

function getRatingClass(row) {
  if (row.rating === "Custom build required") return "custom";
  if (row.complexity === "Unknown") return "unknown";
  return row.complexityClass;
}

function renderPriorityList(rows) {
  const items = rows
    .map((row) => {
      const priority = getPriority(row);
      return {
        row,
        ...priority
      };
    })
    .sort((a, b) => a.rank - b.rank || complexityWeight(b.row.complexity) - complexityWeight(a.row.complexity));

  priorityList.innerHTML = items
    .map(
      (item) => `
        <li>
          <div class="priority-body">
            <div class="priority-topline">
              <strong>${escapeHtml(item.row.displayName)}</strong>
              <span class="priority-chip ${escapeHtml(item.className)}">${escapeHtml(t(item.labelKey))}</span>
            </div>
            <p>${escapeHtml(t(item.reasonKey))}</p>
          </div>
        </li>
      `
    )
    .join("");
}

function getPriority(row) {
  const stage = getRadioValue("odooStage");
  const volume = getRadioValue("dataVolume");

  if (row.complexity === "High" || row.complexity === "Unknown") {
    return {
      rank: 3,
      className: "custom",
      labelKey: "priority.customLabel",
      reasonKey: stage === "alreadyLive" ? "priority.liveReason" : "priority.customReason"
    };
  }

  if (row.affectsSelectedModules) {
    return {
      rank: 1,
      className: "first",
      labelKey: "priority.firstLabel",
      reasonKey: volume === "high" ? "priority.highVolumeReason" : "priority.firstReason"
    };
  }

  return {
    rank: 2,
    className: "later",
    labelKey: "priority.laterLabel",
    reasonKey: "priority.laterReason"
  };
}

function complexityWeight(complexity) {
  return {
    Unknown: 4,
    High: 3,
    Medium: 2,
    Low: 1
  }[complexity] || 0;
}

function showTooltip(systemName, eventTarget) {
  const row = currentRows.find((item) => item.systemName === systemName);
  if (!row) return;

  mapTooltip.className = `map-tooltip ${row.complexityClass}`;
  mapTooltip.innerHTML = `
    <strong>${escapeHtml(row.displayName)}: ${escapeHtml(getComplexityShortLabel(row.complexity))} ${escapeHtml(t("tooltip.complexity"))}</strong>
    <span>${escapeHtml(row.note)}</span>
  `;
  mapTooltip.hidden = false;

  const wrapRect = diagramWrap.getBoundingClientRect();
  const targetRect = eventTarget.getBoundingClientRect();
  const left = targetRect.left - wrapRect.left + diagramWrap.scrollLeft + targetRect.width / 2 + 12;
  const top = targetRect.top - wrapRect.top + diagramWrap.scrollTop + targetRect.height / 2 + 12;
  const maxLeft = diagramWrap.scrollLeft + diagramWrap.clientWidth - 340;

  mapTooltip.style.left = `${Math.max(12, Math.min(left, maxLeft))}px`;
  mapTooltip.style.top = `${Math.max(12, top)}px`;
}

function hideTooltip() {
  mapTooltip.hidden = true;
}

function isMenuOpen() {
  return menuToggle?.getAttribute("aria-expanded") === "true";
}

function setMenuOpen(open) {
  if (!menuToggle || !siteHeader) return;
  siteHeader.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  syncMenuLabel();
}

function syncMenuLabel() {
  if (!menuToggle) return;
  menuToggle.setAttribute("aria-label", t(isMenuOpen() ? "menu.close" : "menu.open"));
}

systemGroupsRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-system]");
  if (!button) return;

  const system = button.dataset.system;
  if (selectedSystems.has(system)) {
    selectedSystems.delete(system);
  } else {
    selectedSystems.add(system);
  }

  renderSystemGroups();
  clearAlert();
});

moduleGroupsRoot.addEventListener("click", (event) => {
  const button = event.target.closest("[data-module]");
  if (!button) return;

  const moduleName = button.dataset.module;
  if (selectedModules.has(moduleName)) {
    selectedModules.delete(moduleName);
  } else {
    selectedModules.add(moduleName);
  }

  renderModuleGroups();
  clearAlert();
});

document.querySelector("[data-add-custom-system]").addEventListener("click", () => {
  const customSystem = normalizeText(customSystemInput.value);
  if (!customSystem) {
    showAlert(t("errors.customSystem"));
    return;
  }

  const knownMatch = getKnownSystems().find((system) => system.toLowerCase() === customSystem.toLowerCase());
  const customMatch = customSystems.find((system) => system.toLowerCase() === customSystem.toLowerCase());
  const label = knownMatch || customMatch || customSystem;

  if (!knownMatch && !customMatch) {
    customSystems.push(customSystem);
  }

  selectedSystems.add(label);
  customSystemInput.value = "";
  renderSystemGroups();
  clearAlert();
});

customSystemInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.querySelector("[data-add-custom-system]").click();
  }
});

document.querySelectorAll("[data-next-step]").forEach((button) => {
  button.addEventListener("click", () => {
    if (Number(button.dataset.nextStep) === 2 && !validateStepOne()) return;
    setStep(Number(button.dataset.nextStep));
  });
});

document.querySelectorAll("[data-prev-step]").forEach((button) => {
  button.addEventListener("click", () => setStep(Number(button.dataset.prevStep)));
});

document.querySelector("[data-generate-results]").addEventListener("click", generateResults);

document.querySelector("[data-reset-tool]").addEventListener("click", () => {
  selectedSystems.clear();
  selectedModules.clear();
  customSystems.splice(0, customSystems.length);
  document.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.checked = false;
  });
  currentRows = [];
  renderSystemGroups();
  renderModuleGroups();
  setStep(1);
});

stackMap.addEventListener("click", (event) => {
  const node = event.target.closest(".map-node");
  if (!node) return;
  event.stopPropagation();
  showTooltip(node.dataset.system, node);
});

stackMap.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const node = event.target.closest(".map-node");
  if (!node) return;
  event.preventDefault();
  showTooltip(node.dataset.system, node);
});

document.addEventListener("click", (event) => {
  if (!diagramWrap.contains(event.target)) hideTooltip();

  if (!isMenuOpen()) return;
  if (siteHeader.contains(event.target)) {
    if (event.target.closest("[data-menu-toggle]")) return;
    if (event.target.closest("[data-header-menu]")) return;
  }
  setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideTooltip();
    setMenuOpen(false);
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

headerMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});

exportPdfButton?.addEventListener("click", exportResultsPdf);
document.querySelector("[data-print-report]")?.addEventListener("click", exportResultsPdf);

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing-results");
});

function exportResultsPdf() {
  if (!currentRows.length || currentStep !== 3) {
    showAlert(t("errors.exportFirst"));
    return;
  }

  hideTooltip();
  const previousTitle = document.title;
  document.title = t("pdf.title");
  document.body.classList.add("printing-results");
  setTimeout(() => {
    window.print();
    document.title = previousTitle;
    setTimeout(() => document.body.classList.remove("printing-results"), 250);
  }, 0);
}

setLanguage(LANGUAGES.has(currentLanguage) ? currentLanguage : "en");
setStep(1);
// Show the badge if the visitor is already known on this device.
renderIdentityBadge(document.querySelector("[data-identity-badge]"), { language: currentLanguage });
