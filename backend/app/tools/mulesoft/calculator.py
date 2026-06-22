"""Faithful port of src/tools/mulesoft-calculator/calculator.js.

Output shape and scoring must match the Node version exactly; the parity test
(tests/test_calculator_parity.py) enforces this against the live Node code.
"""
import math
from decimal import ROUND_HALF_UP, Decimal

SUPPORTED_LANGUAGES = {"en", "pt", "es"}

DEPLOYMENT_LABEL_SETS = {
    "en": {"cloudhub1": "CloudHub 1.0", "cloudhub2": "CloudHub 2.0", "runtimeFabric": "Runtime Fabric", "hybrid": "Hybrid", "unsure": "Unsure"},
    "pt": {"cloudhub1": "CloudHub 1.0", "cloudhub2": "CloudHub 2.0", "runtimeFabric": "Runtime Fabric", "hybrid": "Híbrido", "unsure": "Não sei"},
    "es": {"cloudhub1": "CloudHub 1.0", "cloudhub2": "CloudHub 2.0", "runtimeFabric": "Runtime Fabric", "hybrid": "Híbrido", "unsure": "No sé"},
}

COMMERCIAL_MODEL_LABEL_SETS = {
    "en": {"vcore": "vCore/Core", "flowMessage": "Flows/Messages package", "unsure": "Unsure"},
    "pt": {"vcore": "vCore/Core", "flowMessage": "Pacote por Flows/Messages", "unsure": "Não sei"},
    "es": {"vcore": "vCore/Core", "flowMessage": "Paquete por Flows/Messages", "unsure": "No sé"},
}

RENEWAL_LABEL_SETS = {
    "en": {"0-3": "0-3 months", "3-6": "3-6 months", "6-12": "6-12 months", "notSure": "Not sure"},
    "pt": {"0-3": "0-3 meses", "3-6": "3-6 meses", "6-12": "6-12 meses", "notSure": "Não sei"},
    "es": {"0-3": "0-3 meses", "3-6": "3-6 meses", "6-12": "6-12 meses", "notSure": "No sé"},
}

DEPLOYMENT_LABELS = DEPLOYMENT_LABEL_SETS["en"]
COMMERCIAL_MODEL_LABELS = COMMERCIAL_MODEL_LABEL_SETS["en"]
RENEWAL_LABELS = RENEWAL_LABEL_SETS["en"]

COPY = {
    "en": {
        "riskLevels": {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"},
        "lowUtilizationTitle": "Low utilization",
        "lowUtilizationMessage": lambda pct: f"Average utilization is {pct}%, so some paid capacity may be idle or larger than the workloads need.",
        "moderateUtilizationTitle": "Moderate utilization",
        "moderateUtilizationMessage": lambda pct: f"Average utilization is {pct}%. Review worker size, replicas, and environment allocation before buying more capacity.",
        "healthyUtilizationTitle": "Healthy utilization",
        "healthyUtilizationMessage": lambda pct: f"Average utilization is {pct}%, which suggests capacity is being used more actively. Renewal and deployment alignment should still be reviewed.",
        "appDensityTitle": "Apps per production core",
        "appDensityLowMessage": lambda ratio: f"You are running about {ratio} applications per production core/vCore. That can point to over-allocation or consolidation opportunity.",
        "appDensityHighMessage": lambda ratio: f"You are running about {ratio} applications per production core/vCore, so resilience and isolation should be checked before reducing capacity.",
        "appDensityHealthyMessage": "Your apps-per-capacity ratio does not show an obvious consolidation issue from these inputs.",
        "envBalanceTitle": "Production vs. sandbox capacity",
        "envBalanceHighMessage": "Sandbox/pre-production capacity is higher than production. That is a common place to find capacity cleanup opportunities.",
        "envBalanceMediumMessage": "Sandbox/pre-production allocation is close to production capacity, so environment governance is worth reviewing before renewal.",
        "envBalanceLowMessage": "Sandbox/pre-production allocation appears proportionate to production from this high-level view.",
        "commercialWarningTitle": "Pricing model clarity",
        "commercialUnsureMessage": "Your pricing model is unclear. That uncertainty is a renewal risk because MuleSoft customers may be on legacy core/vCore terms or newer Flows/Messages packages.",
        "commercialVcoreMessage": "Legacy core/vCore terms can hide under-utilization. Compare deployed flows, messages, cores, and renewal options before changing capacity.",
        "commercialFlowMessage": "Flows/Messages packaging still needs governance. Review whether deployed flows and message volumes match business value.",
        "recommendations": [
            "Export current Anypoint usage by environment and business group before renewal discussions.",
            "Review worker sizes, replicas, and stopped/idle applications before buying additional capacity.",
            "Compare production and pre-production allocation against release cadence and support needs.",
        ],
        "renewalRecommendation": "Run a focused renewal readiness review before your next Salesforce/MuleSoft commercial conversation.",
        "apiRecommendation": "Check API Manager and governance usage for API sprawl, duplicated policies, and unclear ownership.",
        "mqRecommendation": "Review MQ usage patterns separately from runtime capacity because messaging workloads often drive hidden operational cost.",
        "wasteMessage": lambda pct: f"Capacity to review: {pct}% of allocated MuleSoft capacity may be idle or oversized. This is directional, not official pricing.",
        "ctaHeadline": "Book a MuleSoft optimization audit with VeriDataPro",
        "ctaMessage": "A short audit can validate idle capacity, renewal exposure, and architecture alignment using your actual Anypoint data.",
        "disclaimer": "This tool provides directional optimization signals, not official MuleSoft pricing.",
    },
    "pt": {
        "riskLevels": {"critical": "Crítico", "high": "Alto", "medium": "Médio", "low": "Baixo"},
        "lowUtilizationTitle": "Baixa utilização",
        "lowUtilizationMessage": lambda pct: f"A utilização média é {pct}%, então parte da capacidade paga pode estar ociosa ou acima do necessário.",
        "moderateUtilizationTitle": "Utilização moderada",
        "moderateUtilizationMessage": lambda pct: f"A utilização média é {pct}%. Revise tamanho de workers, réplicas e alocação por ambiente antes de comprar mais capacidade.",
        "healthyUtilizationTitle": "Utilização saudável",
        "healthyUtilizationMessage": lambda pct: f"A utilização média é {pct}%, o que sugere uso mais ativo da capacidade. A adequação da implantação e da renovação ainda deve ser revisada.",
        "appDensityTitle": "Aplicações por core de produção",
        "appDensityLowMessage": lambda ratio: f"Você executa cerca de {ratio} aplicações por core/vCore de produção. Isso pode indicar sobrealocação ou oportunidade de consolidação.",
        "appDensityHighMessage": lambda ratio: f"Você executa cerca de {ratio} aplicações por core/vCore de produção; por isso, resiliência e isolamento devem ser avaliados antes de reduzir capacidade.",
        "appDensityHealthyMessage": "A relação entre aplicações e capacidade não mostra um problema óbvio de consolidação com estes dados.",
        "envBalanceTitle": "Produção vs. sandbox",
        "envBalanceHighMessage": "A capacidade de sandbox/pré-produção está acima da produção. Esse costuma ser um ponto claro para reduzir capacidade mal alocada.",
        "envBalanceMediumMessage": "A alocação de sandbox/pré-produção está próxima da capacidade de produção, então vale revisar a governança de ambientes antes da renovação.",
        "envBalanceLowMessage": "A alocação de sandbox/pré-produção parece proporcional à produção nesta visão de alto nível.",
        "commercialWarningTitle": "Clareza do modelo comercial",
        "commercialUnsureMessage": "Seu modelo comercial não está claro. Essa incerteza já é um risco de renovação, pois clientes MuleSoft podem estar em contratos legados core/vCore ou pacotes por Flows/Messages.",
        "commercialVcoreMessage": "Contratos legados core/vCore podem esconder subutilização. Compare flows, messages, cores e opções de renovação antes de alterar capacidade.",
        "commercialFlowMessage": "Pacotes por Flows/Messages também exigem governança. Revise se flows implantados e volumes de mensagens acompanham valor de negócio.",
        "recommendations": [
            "Exporte o uso atual do Anypoint por ambiente e business group antes da renovação.",
            "Revise tamanhos de workers, réplicas e aplicações paradas/ociosas antes de comprar capacidade adicional.",
            "Compare a alocação de produção e pré-produção com a cadência de releases e necessidades de suporte.",
        ],
        "renewalRecommendation": "Faça uma revisão focada de prontidão para renovação antes da próxima conversa comercial Salesforce/MuleSoft.",
        "apiRecommendation": "Revise API Manager e governança para identificar excesso de APIs, políticas duplicadas e responsáveis indefinidos.",
        "mqRecommendation": "Revise o uso de MQ separadamente da capacidade de runtime, porque workloads de mensageria costumam gerar custo operacional oculto.",
        "wasteMessage": lambda pct: f"Capacidade a revisar: {pct}% da capacidade MuleSoft alocada pode estar ociosa ou acima do necessário. Este é um sinal direcional, não preço oficial.",
        "ctaHeadline": "Agende uma auditoria de otimização MuleSoft com a VeriDataPro",
        "ctaMessage": "Uma auditoria curta pode validar capacidade ociosa, risco na renovação e adequação da arquitetura usando seus dados reais do Anypoint.",
        "disclaimer": "Esta ferramenta fornece sinais direcionais de otimização, não preços oficiais do MuleSoft.",
    },
    "es": {
        "riskLevels": {"critical": "Crítico", "high": "Alto", "medium": "Medio", "low": "Bajo"},
        "lowUtilizationTitle": "Baja utilización",
        "lowUtilizationMessage": lambda pct: f"La utilización promedio es {pct}%, por lo que parte de la capacidad pagada podría estar ociosa o sobredimensionada.",
        "moderateUtilizationTitle": "Utilización moderada",
        "moderateUtilizationMessage": lambda pct: f"La utilización promedio es {pct}%. Revisa tamaño de workers, réplicas y asignación por ambiente antes de comprar más capacidad.",
        "healthyUtilizationTitle": "Utilización saludable",
        "healthyUtilizationMessage": lambda pct: f"La utilización promedio es {pct}%, lo que sugiere un uso más activo de la capacidad. El ajuste de despliegue y renovación aún debe revisarse.",
        "appDensityTitle": "Aplicaciones por core de producción",
        "appDensityLowMessage": lambda ratio: f"Estás ejecutando cerca de {ratio} aplicaciones por core/vCore de producción. Eso puede indicar sobreasignación u oportunidad de consolidación.",
        "appDensityHighMessage": lambda ratio: f"Estás ejecutando cerca de {ratio} aplicaciones por core/vCore de producción; por eso, resiliencia y aislamiento deben revisarse antes de reducir capacidad.",
        "appDensityHealthyMessage": "La relación entre aplicaciones y capacidad no muestra un problema obvio de consolidación con estos datos.",
        "envBalanceTitle": "Producción vs. sandbox",
        "envBalanceHighMessage": "La capacidad de sandbox/pre-producción es mayor que producción. Suele ser un punto claro para reducir capacidad mal asignada.",
        "envBalanceMediumMessage": "La asignación de sandbox/pre-producción está cerca de la capacidad de producción, así que conviene revisar la gobernanza de ambientes antes de renovar.",
        "envBalanceLowMessage": "La asignación de sandbox/pre-producción parece proporcional a producción en esta vista de alto nivel.",
        "commercialWarningTitle": "Claridad del modelo comercial",
        "commercialUnsureMessage": "Tu modelo comercial no está claro. Esa incertidumbre ya es un riesgo de renovación porque clientes MuleSoft pueden estar en contratos heredados core/vCore o paquetes por Flows/Messages.",
        "commercialVcoreMessage": "Los contratos heredados core/vCore pueden esconder subutilización. Compara flows, messages, cores y opciones de renovación antes de cambiar capacidad.",
        "commercialFlowMessage": "Los paquetes por Flows/Messages también necesitan gobernanza. Revisa si los flows desplegados y los volúmenes de mensajes se alinean con el valor de negocio.",
        "recommendations": [
            "Exporta el uso actual de Anypoint por ambiente y business group antes de renovar.",
            "Revisa tamaños de workers, réplicas y aplicaciones detenidas/ociosas antes de comprar capacidad adicional.",
            "Compara la asignación de producción y pre-producción con la cadencia de releases y necesidades de soporte.",
        ],
        "renewalRecommendation": "Ejecuta una revisión enfocada de preparación para renovación antes de tu próxima conversación comercial Salesforce/MuleSoft.",
        "apiRecommendation": "Revisa API Manager y gobernanza para identificar exceso de APIs, políticas duplicadas y responsables indefinidos.",
        "mqRecommendation": "Revisa el uso de MQ por separado de la capacidad de runtime, porque las cargas de mensajería suelen generar costo operativo oculto.",
        "wasteMessage": lambda pct: f"Capacidad a revisar: {pct}% de la capacidad MuleSoft asignada podría estar ociosa o sobredimensionada. Esta es una señal direccional, no precio oficial.",
        "ctaHeadline": "Agenda una auditoría de optimización MuleSoft con VeriDataPro",
        "ctaMessage": "Una auditoría corta puede validar capacidad ociosa, riesgo de renovación y ajuste de arquitectura usando tus datos reales de Anypoint.",
        "disclaimer": "Esta herramienta entrega señales direccionales de optimización, no precios oficiales de MuleSoft.",
    },
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def js_round(value: float) -> int:
    """Match JavaScript Math.round (round half up). Inputs here are non-negative."""
    return math.floor(value + 0.5)


def normalize_language(language: str | None) -> str:
    return language if language in SUPPORTED_LANGUAGES else "en"


def risk_key(score: float) -> str:
    if score >= 78:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 32:
        return "medium"
    return "low"


def risk_level(score: float, language: str = "en") -> str:
    return COPY[normalize_language(language)]["riskLevels"][risk_key(score)]


def calculate_assessment(data: dict) -> dict:
    language = normalize_language(data.get("language"))
    copy = COPY[language]
    deployment_labels = DEPLOYMENT_LABEL_SETS[language]
    commercial_labels = COMMERCIAL_MODEL_LABEL_SETS[language]
    renewal_labels = RENEWAL_LABEL_SETS[language]

    production_cores = float(data["productionCores"])
    sandbox_cores = float(data["sandboxCores"])
    running_applications = float(data["runningApplications"])
    utilization_pct = float(data["utilizationPct"])
    managed_apis = float(data["managedApis"])
    addons = data.get("addons") or []

    total_cores = production_cores + sandbox_cores
    utilization_waste = clamp(100 - utilization_pct, 0, 100)
    if production_cores > 0:
        sandbox_ratio = sandbox_cores / production_cores
    else:
        sandbox_ratio = 2 if sandbox_cores > 0 else 0
    apps_per_production_core = running_applications / production_cores if production_cores > 0 else 0
    api_per_app_ratio = managed_apis / running_applications if running_applications > 0 else managed_apis

    score = 0.0
    score += 38 if utilization_pct < 25 else 28 if utilization_pct < 45 else 14 if utilization_pct < 65 else 4
    score += 16 if sandbox_ratio > 1.25 else 9 if sandbox_ratio > 0.75 else 0
    score += 14 if (apps_per_production_core < 2 and production_cores >= 4) else 8 if (apps_per_production_core < 4 and production_cores >= 8) else 0
    score += 16 if data.get("commercialModel") == "unsure" else 8 if data.get("commercialModel") == "vcore" else 4
    score += 7 if data.get("deploymentModel") == "unsure" else 5 if data.get("deploymentModel") == "hybrid" else 2
    score += 14 if data.get("renewalTimeline") == "0-3" else 9 if data.get("renewalTimeline") == "3-6" else 5 if data.get("renewalTimeline") == "notSure" else 2
    score += 7 if managed_apis > 80 else 4 if managed_apis > 30 else 0
    score += 5 if (isinstance(addons, list) and len(addons) >= 4) else 0
    score = clamp(js_round(score), 0, 100)

    estimated_waste_percent = clamp(
        js_round(
            utilization_waste * 0.75
            + (10 if sandbox_ratio > 1 else 0)
            + (8 if (apps_per_production_core < 2 and production_cores >= 4) else 0)
        ),
        0,
        90,
    )

    signals = []

    if utilization_pct < 45:
        signals.append({
            "title": copy["lowUtilizationTitle"],
            "severity": "critical" if utilization_pct < 25 else "high",
            "message": copy["lowUtilizationMessage"](_int_or_num(utilization_pct)),
        })
    elif utilization_pct < 70:
        signals.append({"title": copy["moderateUtilizationTitle"], "severity": "medium", "message": copy["moderateUtilizationMessage"](_int_or_num(utilization_pct))})
    else:
        signals.append({"title": copy["healthyUtilizationTitle"], "severity": "low", "message": copy["healthyUtilizationMessage"](_int_or_num(utilization_pct))})

    if apps_per_production_core > 0 and apps_per_production_core < 2 and production_cores >= 4:
        signals.append({"title": copy["appDensityTitle"], "severity": "high", "message": copy["appDensityLowMessage"](_to_fixed1(apps_per_production_core))})
    elif apps_per_production_core >= 8:
        signals.append({"title": copy["appDensityTitle"], "severity": "medium", "message": copy["appDensityHighMessage"](_to_fixed1(apps_per_production_core))})
    else:
        signals.append({"title": copy["appDensityTitle"], "severity": "low", "message": copy["appDensityHealthyMessage"]})

    if sandbox_ratio > 1.25:
        signals.append({"title": copy["envBalanceTitle"], "severity": "high", "message": copy["envBalanceHighMessage"]})
    elif sandbox_ratio > 0.75:
        signals.append({"title": copy["envBalanceTitle"], "severity": "medium", "message": copy["envBalanceMediumMessage"]})
    else:
        signals.append({"title": copy["envBalanceTitle"], "severity": "low", "message": copy["envBalanceLowMessage"]})

    if data.get("commercialModel") == "unsure":
        signals.append({"title": copy["commercialWarningTitle"], "severity": "high", "message": copy["commercialUnsureMessage"]})
    elif data.get("commercialModel") == "vcore":
        signals.append({"title": copy["commercialWarningTitle"], "severity": "medium", "message": copy["commercialVcoreMessage"]})
    else:
        signals.append({"title": copy["commercialWarningTitle"], "severity": "medium", "message": copy["commercialFlowMessage"]})

    recommendations = list(copy["recommendations"])

    if data.get("commercialModel") == "unsure" or data.get("renewalTimeline") in ("0-3", "3-6"):
        recommendations.insert(0, copy["renewalRecommendation"])

    if api_per_app_ratio > 5:
        recommendations.append(copy["apiRecommendation"])

    if isinstance(addons, list) and "mq" in addons:
        recommendations.append(copy["mqRecommendation"])

    score_int = int(score)
    waste_int = int(estimated_waste_percent)

    return {
        "language": language,
        "risk": {"score": score_int, "level": risk_level(score_int, language), "severity": risk_key(score_int)},
        "waste": {"estimatedPercent": waste_int, "message": copy["wasteMessage"](waste_int)},
        "footprint": {
            "deploymentModel": deployment_labels.get(data.get("deploymentModel")),
            "commercialModel": commercial_labels.get(data.get("commercialModel")),
            "renewalTimeline": renewal_labels.get(data.get("renewalTimeline")),
            "totalCores": _int_or_num(total_cores),
            "appsPerProductionCore": _round1_number(apps_per_production_core),
        },
        "signals": signals,
        "recommendations": recommendations,
        "cta": {"headline": copy["ctaHeadline"], "message": copy["ctaMessage"]},
        "disclaimer": copy["disclaimer"],
    }


def _int_or_num(value: float):
    """JS prints integral floats without a decimal point in template strings."""
    return int(value) if float(value) == int(value) else value


def _to_fixed1(value: float) -> str:
    """Match Number.prototype.toFixed(1) — always one decimal place, as a string."""
    return str(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _round1_number(value: float):
    """Match Number(x.toFixed(1)) — numeric, integral values lose the .0."""
    rounded = float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
    return int(rounded) if rounded == int(rounded) else rounded
