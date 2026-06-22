import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
LANGUAGES = {"en", "pt", "es"}


class ContactSubmission(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    fullName: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=160)
    company: str = Field(min_length=1, max_length=120)
    language: str = "en"
    clientId: str = Field(default="", max_length=64)
    source: str = Field(default="", max_length=80)

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
        return value if value in LANGUAGES else "en"
