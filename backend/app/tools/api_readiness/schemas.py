"""Pydantic models for the api-readiness assessment (replaces validation.js)."""
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
WEBSITE_PATTERN = re.compile(r"^(https?://)?([a-z0-9-]+\.)+[a-z]{2,}(/.*)?$", re.IGNORECASE)

COMPANY_SIZES = {"1-10", "11-50", "51-200", "201-1000", "1000+"}
TIMELINES = {"now", "1-3", "3-6", "exploring"}
SystemType = Literal["odoo", "crm", "ecommerce", "finance", "spreadsheets", "databases", "internal", "support", "other"]


class ApiReadinessLead(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    fullName: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=160)
    company: str = Field(min_length=1, max_length=120)
    # The "Optional" section: website, companySize and timeline are all optional.
    website: str = Field(default="", max_length=180)
    companySize: str = Field(default="")
    timeline: str = Field(default="")

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        value = value.lower()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("website")
    @classmethod
    def _website(cls, value: str) -> str:
        if value and not WEBSITE_PATTERN.match(value):
            raise ValueError("Enter a valid website.")
        return value

    @field_validator("companySize")
    @classmethod
    def _company_size(cls, value: str) -> str:
        if value and value not in COMPANY_SIZES:
            raise ValueError("Choose a valid company size.")
        return value

    @field_validator("timeline")
    @classmethod
    def _timeline(cls, value: str) -> str:
        if value and value not in TIMELINES:
            raise ValueError("Choose a valid timeline.")
        return value


class ApiReadinessAnswers(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    systemsCount: Literal["1-3", "4-7", "8-12", "13+"]
    systemTypes: list[SystemType] = Field(min_length=1)
    manualCopyFrequency: Literal["rarely", "weekly", "daily", "multipleDaily"]
    spreadsheetDependency: Literal["low", "medium", "heavy"]
    apiAvailability: Literal["most", "some", "unknown", "none"]
    sourceOfTruth: Literal["clear", "mostly", "unclear", "none"]
    dataQuality: Literal["clean", "minor", "inconsistent", "poor"]
    reportingConsistency: Literal["consistent", "minorDifferences", "differentTeams", "manualReports"]
    integrationReliability: Literal["reliable", "occasional", "oftenBreak", "manualFixes"]
    systemOwnership: Literal["clearOwners", "someOwners", "unclear", "noOwner"]
    upcomingMigration: Literal["none", "ready", "plannedDataConcerns", "activePoorReadiness"]
    biggestProblem: str = Field(min_length=1, max_length=600)

    @field_validator("systemTypes")
    @classmethod
    def _dedupe(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class ApiReadinessSubmission(BaseModel):
    language: Literal["en", "pt", "es"] = "en"
    lead: ApiReadinessLead
    answers: ApiReadinessAnswers
