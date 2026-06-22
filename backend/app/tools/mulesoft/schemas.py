"""Pydantic request model — replaces the hand-rolled validation.js.

Behavioural parity with the Node validator: same required fields, email shape,
enum membership, numeric ranges, and addon allow-list. Error *messages* are
Pydantic's (clearer/structured); the router reshapes them into the existing
{ "error": ..., "fields": {field: message} } contract the frontend expects.
"""
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
DEPLOYMENT_MODELS = {"cloudhub1", "cloudhub2", "runtimeFabric", "hybrid", "unsure"}
COMMERCIAL_MODELS = {"vcore", "flowMessage", "unsure"}
RENEWAL_TIMELINES = {"0-3", "3-6", "6-12", "notSure"}
ADDONS = {"apiManager", "mq", "objectStore", "monitoring", "flexGateway", "other", "unsure"}
LANGUAGES = {"en", "pt", "es"}


class MulesoftSubmission(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    fullName: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=160)
    company: str = Field(min_length=1, max_length=120)
    language: str = "en"
    deploymentModel: str
    commercialModel: str
    renewalTimeline: str
    productionCores: float = Field(ge=0, le=10000)
    sandboxCores: float = Field(ge=0, le=10000)
    runningApplications: int = Field(ge=0, le=10000)
    utilizationPct: float = Field(ge=0, le=100)
    managedApis: int = Field(ge=0, le=100000)
    addons: list[str] = Field(default_factory=list)
    clientId: str = ""

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        value = value.lower()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("language")
    @classmethod
    def _supported_language(cls, value: str) -> str:
        if value not in LANGUAGES:
            raise ValueError("Choose a supported language.")
        return value

    @field_validator("deploymentModel")
    @classmethod
    def _valid_deployment(cls, value: str) -> str:
        if value not in DEPLOYMENT_MODELS:
            raise ValueError("Choose a deployment model.")
        return value

    @field_validator("commercialModel")
    @classmethod
    def _valid_commercial(cls, value: str) -> str:
        if value not in COMMERCIAL_MODELS:
            raise ValueError("Choose a commercial model.")
        return value

    @field_validator("renewalTimeline")
    @classmethod
    def _valid_renewal(cls, value: str) -> str:
        if value not in RENEWAL_TIMELINES:
            raise ValueError("Choose a renewal timeline.")
        return value

    @field_validator("addons")
    @classmethod
    def _valid_addons(cls, value: list[str]) -> list[str]:
        deduped = list(dict.fromkeys(v for v in value if v))
        if any(addon not in ADDONS for addon in deduped):
            raise ValueError("Choose only supported add-ons.")
        return deduped
