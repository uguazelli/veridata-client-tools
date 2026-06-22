from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ..errors import validation_fields
from .calculator import calculate_assessment
from .schemas import MulesoftSubmission
from .store import save_lead


def build_router(base_path: str) -> APIRouter:
    router = APIRouter()

    @router.post(f"{base_path}/api/calculate")
    async def calculate(request: Request):
        body = await request.json()
        try:
            submission = MulesoftSubmission.model_validate(body)
        except ValidationError as exc:
            return JSONResponse(status_code=400, content={"error": "Validation failed.", "fields": validation_fields(exc)})

        data = submission.model_dump()
        result = calculate_assessment(data)
        save_lead(data, result, request.headers.get("user-agent"))
        return {"result": result}

    return router
