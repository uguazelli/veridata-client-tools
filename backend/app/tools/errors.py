"""Shared helper: reshape Pydantic errors into the { field: message } contract
the frontend expects (matching the Node API's 400 response body)."""
from pydantic import ValidationError


def validation_fields(exc: ValidationError) -> dict[str, str]:
    fields: dict[str, str] = {}
    for err in exc.errors():
        field = str(err["loc"][-1]) if err["loc"] else "_"
        message = err["msg"].replace("Value error, ", "")
        fields.setdefault(field, message)
    return fields
