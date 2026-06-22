"""Faithful port of src/tools/api-readiness/scoringService.js.

Verified against frozen Node fixtures in tests/golden/api_readiness.json.
"""
import math

SUPPORTED_LANGUAGES = {"en", "pt", "es"}

STATUS_THRESHOLDS = [(80, "ready"), (60, "partial"), (40, "risk"), (0, "notReady")]

COPY = {
    "en": {
        "status": {"ready": "Integration Ready", "partial": "Partially Ready", "risk": "At Risk", "notReady": "Not Ready"},
        "pain": {
            "manySystems": "Many systems need coordination",
            "tooManySystems": "High system sprawl",
            "manualDaily": "Daily manual data copying",
            "manualMultiple": "Manual copying happens multiple times per day",
            "spreadsheetMedium": "Important work still depends on spreadsheets",
            "spreadsheetHeavy": "Heavy spreadsheet dependency",
            "apiUnknown": "API availability is unclear",
            "apiNone": "Core systems may not expose usable APIs",
            "sourceUnclear": "No clear source of truth",
            "sourceNone": "Teams do not share a trusted system of record",
            "dataInconsistent": "Data quality issues may block automation",
            "dataPoor": "Data needs cleanup before serious integration work",
            "reportingDifferent": "Different teams report different numbers",
            "reportingManual": "Reporting depends on manual work",
            "unreliable": "Integrations break often",
            "manualFixes": "Integrations require manual fixes",
            "ownerUnclear": "System ownership is unclear",
            "noOwner": "No clear system owner",
            "migrationConcerns": "Upcoming migration has data concerns",
            "migrationPoor": "Migration is active but data is not ready",
        },
        "recommendation": {
            "ready": "You appear ready to plan integration improvements. Start with a focused review of the highest-value workflows and API coverage.",
            "partial": "You have a workable base, but manual work and ownership gaps should be cleaned up before scaling integrations.",
            "risk": "Start with an integration readiness review. Clarify ownership, source of truth, and data quality before major automation work.",
            "notReady": "Fix the foundation first: identify system owners, define the source of truth, reduce spreadsheet dependency, and clean critical data before integration projects.",
        },
    },
    "pt": {
        "status": {"ready": "Pronto para integração", "partial": "Parcialmente pronto", "risk": "Em risco", "notReady": "Não está pronto"},
        "pain": {
            "manySystems": "Muitos sistemas precisam ser coordenados",
            "tooManySystems": "Excesso de sistemas em uso",
            "manualDaily": "Cópia manual de dados todos os dias",
            "manualMultiple": "Cópia manual acontece várias vezes ao dia",
            "spreadsheetMedium": "Processos importantes ainda dependem de planilhas",
            "spreadsheetHeavy": "Dependência alta de planilhas",
            "apiUnknown": "Não está claro se os sistemas têm APIs",
            "apiNone": "Sistemas principais podem não ter APIs utilizáveis",
            "sourceUnclear": "Não há fonte única de verdade clara",
            "sourceNone": "As equipes não usam um sistema confiável como referência",
            "dataInconsistent": "Problemas de dados podem bloquear automações",
            "dataPoor": "Os dados precisam de limpeza antes de integrações sérias",
            "reportingDifferent": "Equipes diferentes reportam números diferentes",
            "reportingManual": "Relatórios dependem de trabalho manual",
            "unreliable": "Integrações quebram com frequência",
            "manualFixes": "Integrações exigem correções manuais",
            "ownerUnclear": "Responsabilidade pelos sistemas não está clara",
            "noOwner": "Não há responsável claro pelos sistemas",
            "migrationConcerns": "Migração futura tem riscos de dados",
            "migrationPoor": "A migração já está ativa, mas os dados não estão prontos",
        },
        "recommendation": {
            "ready": "Você parece pronto para planejar melhorias de integração. Comece revisando os fluxos de maior valor e a cobertura de APIs.",
            "partial": "Existe uma boa base, mas trabalho manual e lacunas de responsabilidade devem ser resolvidos antes de escalar integrações.",
            "risk": "Comece com uma revisão de prontidão para integração. Defina responsáveis, fonte de verdade e qualidade de dados antes de grandes automações.",
            "notReady": "Arrume a base primeiro: defina responsáveis, fonte de verdade, reduza dependência de planilhas e limpe dados críticos antes de projetos de integração.",
        },
    },
    "es": {
        "status": {"ready": "Listo para integración", "partial": "Parcialmente listo", "risk": "En riesgo", "notReady": "No está listo"},
        "pain": {
            "manySystems": "Muchos sistemas necesitan coordinación",
            "tooManySystems": "Demasiados sistemas en uso",
            "manualDaily": "Copia manual de datos todos los días",
            "manualMultiple": "La copia manual ocurre varias veces por día",
            "spreadsheetMedium": "Procesos importantes aún dependen de hojas de cálculo",
            "spreadsheetHeavy": "Alta dependencia de hojas de cálculo",
            "apiUnknown": "No está claro si los sistemas tienen APIs",
            "apiNone": "Los sistemas principales podrían no tener APIs utilizables",
            "sourceUnclear": "No hay una fuente única de verdad clara",
            "sourceNone": "Los equipos no comparten un sistema confiable como referencia",
            "dataInconsistent": "Problemas de datos pueden bloquear automatizaciones",
            "dataPoor": "Los datos necesitan limpieza antes de integraciones serias",
            "reportingDifferent": "Equipos diferentes reportan números diferentes",
            "reportingManual": "Los reportes dependen de trabajo manual",
            "unreliable": "Las integraciones fallan con frecuencia",
            "manualFixes": "Las integraciones requieren correcciones manuales",
            "ownerUnclear": "La responsabilidad de los sistemas no está clara",
            "noOwner": "No hay responsable claro de los sistemas",
            "migrationConcerns": "La próxima migración tiene riesgos de datos",
            "migrationPoor": "La migración ya está activa, pero los datos no están listos",
        },
        "recommendation": {
            "ready": "Parece que estás listo para planear mejoras de integración. Empieza revisando los flujos de mayor valor y la cobertura de APIs.",
            "partial": "Hay una base útil, pero el trabajo manual y las brechas de responsabilidad deben corregirse antes de escalar integraciones.",
            "risk": "Empieza con una revisión de preparación para integración. Define responsables, fuente de verdad y calidad de datos antes de grandes automatizaciones.",
            "notReady": "Arregla la base primero: define responsables, fuente de verdad, reduce dependencia de hojas de cálculo y limpia datos críticos antes de proyectos de integración.",
        },
    },
}


def clamp_score(value: float) -> int:
    return max(0, min(100, math.floor(value + 0.5)))


def normalize_language(language) -> str:
    return language if language in SUPPORTED_LANGUAGES else "en"


def get_status_key(score: int) -> str:
    for minimum, key in STATUS_THRESHOLDS:
        if score >= minimum:
            return key
    return "notReady"


def calculate_assessment_result(answers: dict) -> dict:
    language = normalize_language(answers.get("language"))
    copy = COPY[language]
    pain_points: list[dict] = []
    score = 100.0
    cat = {"systemComplexity": 0, "manualWork": 0, "dataReadiness": 0, "apiReadiness": 0, "operationalRisk": 0}

    def pain(key: str, weight: int):
        pain_points.append({"key": key, "label": copy["pain"][key], "weight": weight})

    systems_count = answers.get("systemsCount")
    if systems_count == "8-12":
        score -= 5
        cat["systemComplexity"] += 15
        pain("manySystems", 5)
    if systems_count == "13+":
        score -= 10
        cat["systemComplexity"] += 25
        pain("tooManySystems", 10)

    system_types = answers.get("systemTypes")
    if isinstance(system_types, list) and len(system_types) >= 5:
        score -= 5
        cat["systemComplexity"] += 10

    if answers.get("manualCopyFrequency") == "daily":
        score -= 20
        cat["manualWork"] += 35
        cat["operationalRisk"] += 12
        pain("manualDaily", 20)
    if answers.get("manualCopyFrequency") == "multipleDaily":
        score -= 25
        cat["manualWork"] += 45
        cat["operationalRisk"] += 18
        pain("manualMultiple", 25)
    if answers.get("manualCopyFrequency") == "weekly":
        score -= 8
        cat["manualWork"] += 15

    if answers.get("spreadsheetDependency") == "medium":
        score -= 8
        cat["manualWork"] += 12
        cat["dataReadiness"] += 8
        pain("spreadsheetMedium", 8)
    if answers.get("spreadsheetDependency") == "heavy":
        score -= 15
        cat["manualWork"] += 25
        cat["dataReadiness"] += 15
        pain("spreadsheetHeavy", 15)

    if answers.get("apiAvailability") == "some":
        score -= 5
        cat["apiReadiness"] += 12
    if answers.get("apiAvailability") == "unknown":
        score -= 10
        cat["apiReadiness"] += 25
        pain("apiUnknown", 10)
    if answers.get("apiAvailability") == "none":
        score -= 15
        cat["apiReadiness"] += 35
        pain("apiNone", 15)

    if answers.get("sourceOfTruth") == "mostly":
        score -= 5
        cat["dataReadiness"] += 10
    if answers.get("sourceOfTruth") == "unclear":
        score -= 10
        cat["dataReadiness"] += 22
        pain("sourceUnclear", 10)
    if answers.get("sourceOfTruth") == "none":
        score -= 15
        cat["dataReadiness"] += 35
        pain("sourceNone", 15)

    if answers.get("dataQuality") == "minor":
        score -= 5
        cat["dataReadiness"] += 10
    if answers.get("dataQuality") == "inconsistent":
        score -= 10
        cat["dataReadiness"] += 22
        pain("dataInconsistent", 10)
    if answers.get("dataQuality") == "poor":
        score -= 15
        cat["dataReadiness"] += 35
        pain("dataPoor", 15)

    if answers.get("reportingConsistency") == "minorDifferences":
        score -= 5
        cat["dataReadiness"] += 8
    if answers.get("reportingConsistency") == "differentTeams":
        score -= 15
        cat["dataReadiness"] += 25
        cat["operationalRisk"] += 10
        pain("reportingDifferent", 15)
    if answers.get("reportingConsistency") == "manualReports":
        score -= 12
        cat["manualWork"] += 18
        cat["dataReadiness"] += 15
        pain("reportingManual", 12)

    if answers.get("integrationReliability") == "occasional":
        score -= 7
        cat["apiReadiness"] += 8
        cat["operationalRisk"] += 10
    if answers.get("integrationReliability") == "oftenBreak":
        score -= 15
        cat["apiReadiness"] += 18
        cat["operationalRisk"] += 25
        pain("unreliable", 15)
    if answers.get("integrationReliability") == "manualFixes":
        score -= 18
        cat["manualWork"] += 15
        cat["operationalRisk"] += 30
        pain("manualFixes", 18)

    if answers.get("systemOwnership") == "someOwners":
        score -= 4
        cat["operationalRisk"] += 8
    if answers.get("systemOwnership") == "unclear":
        score -= 8
        cat["operationalRisk"] += 18
        pain("ownerUnclear", 8)
    if answers.get("systemOwnership") == "noOwner":
        score -= 10
        cat["operationalRisk"] += 24
        pain("noOwner", 10)

    if answers.get("upcomingMigration") == "plannedDataConcerns":
        score -= 7
        cat["systemComplexity"] += 10
        cat["dataReadiness"] += 12
        cat["operationalRisk"] += 8
        pain("migrationConcerns", 7)
    if answers.get("upcomingMigration") == "activePoorReadiness":
        score -= 10
        cat["systemComplexity"] += 15
        cat["dataReadiness"] += 18
        cat["operationalRisk"] += 15
        pain("migrationPoor", 10)

    final_score = clamp_score(score)
    status_key = get_status_key(final_score)
    # Stable sort by descending weight (matches V8's stable Array.sort), top 5.
    sorted_pain = sorted(pain_points, key=lambda p: p["weight"], reverse=True)[:5]

    return {
        "score": final_score,
        "statusKey": status_key,
        "status": copy["status"][status_key],
        "categoryScores": {
            "systemComplexity": clamp_score(100 - cat["systemComplexity"]),
            "manualWork": clamp_score(100 - cat["manualWork"]),
            "dataReadiness": clamp_score(100 - cat["dataReadiness"]),
            "apiReadiness": clamp_score(100 - cat["apiReadiness"]),
            "operationalRisk": clamp_score(100 - cat["operationalRisk"]),
        },
        "painPoints": [p["label"] for p in sorted_pain],
        "recommendation": copy["recommendation"][status_key],
    }
