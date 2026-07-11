"""Pydantic model for the MuleSoft to AWS migration request."""
import re
from typing import Literal, List

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
WEBSITE_PATTERN = re.compile(r"^(https?://)?([a-z0-9-]+\.)+[a-z]{2,}(/.*)?$", re.IGNORECASE)


class MuleSoftToAwsMigrationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    language: Literal["en", "pt", "es"] = "en"
    fullName: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=160)
    company: str = Field(min_length=1, max_length=120)
    role: str = Field(default="", max_length=120)
    website: str = Field(default="", max_length=180)
    companySize: Literal["1-10", "11-50", "51-200", "201-1000", "1000+"]
    timeline: Literal["now", "1-3", "3-6", "exploring"]
    primaryChallenge: str = Field(min_length=1, max_length=240)
    muleApplications: int = Field(ge=0, default=0)
    targetAwsServices: List[str] = Field(default_factory=list)

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
