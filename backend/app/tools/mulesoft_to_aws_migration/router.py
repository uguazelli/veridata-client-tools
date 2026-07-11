from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ..errors import validation_fields
from .schemas import MuleSoftToAwsMigrationRequest
from .store import save_lead

FILE_NAME = "MuleSoft_to_AWS_Migration_Calculator_VeriData.xlsx"
FILE_REL_PATH = f"tools/mulesoft-to-aws-migration/{FILE_NAME}"


def build_router(base_path: str) -> APIRouter:
    router = APIRouter()

    @router.post(f"{base_path}/api/request")
    async def request_calculator(request: Request):
        body = await request.json()
        try:
            data = MuleSoftToAwsMigrationRequest.model_validate(body)
        except ValidationError as exc:
            return JSONResponse(status_code=400, content={"error": "Validation failed.", "fields": validation_fields(exc)})

        save_lead(data.model_dump(), FILE_NAME, request.headers.get("user-agent"))
        return {"download": {"fileName": FILE_NAME, "url": f"{base_path}/{FILE_REL_PATH}"}}

    return router
