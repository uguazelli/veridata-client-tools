from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .schemas import ContactSubmission
from .store import upsert_contact

router = APIRouter()


@router.post("/api/contact")
async def create_contact(request: Request):
    body = await request.json()
    try:
        contact = ContactSubmission.model_validate(body)
    except ValidationError as exc:
        fields = {str(e["loc"][-1]): e["msg"].replace("Value error, ", "") for e in exc.errors()}
        return JSONResponse(status_code=400, content={"error": "Validation failed.", "fields": fields})

    data = contact.model_dump()
    outcome = upsert_contact(data, request.headers.get("user-agent"))
    return {"status": "ok", "outcome": outcome, "contact": data}
