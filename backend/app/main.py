import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import PUBLIC_DIR, settings
from .db import init_db
from .tools.api_readiness.router import build_router as build_api_readiness_router
from .tools.contact.router import router as contact_router
from .tools.integration_audit.router import build_router as build_integration_audit_router
from .tools.mulesoft.router import build_router as build_mulesoft_router

logger = logging.getLogger("veridatapro")

# (base_path setting, html relative path) for every statically served tool.
STATIC_TOOLS = [
    ("docs_base", "tools/index.html"),
    ("mulesoft_base", "tools/mulesoft-calculator/index.html"),
    ("api_readiness_base", "tools/api-readiness/index.html"),
    ("file_validator_base", "tools/file-validator/index.html"),
    ("integration_audit_base", "tools/integration-audit-pack/index.html"),
    ("odoo_base", "tools/odoo-complexity-mapper/index.html"),
]


def render_tool_html(html_rel_path: str, base_path: str) -> str:
    """Mirror src/shared/staticToolRoutes.js: inject the base path into the page."""
    template = (PUBLIC_DIR / html_rel_path).read_text(encoding="utf-8")
    return template.replace("__BASE_PATH__", base_path or "")


def register_static_tool(app: FastAPI, base_path: str, html_rel_path: str) -> None:
    if base_path:
        @app.get(base_path, include_in_schema=False)
        def _redirect_to_slash():
            return RedirectResponse(url=f"{base_path}/", status_code=308)

    @app.get(f"{base_path}/", response_class=HTMLResponse, include_in_schema=False)
    def _serve_index():
        return render_tool_html(html_rel_path, base_path)

    app.mount(base_path or "/", StaticFiles(directory=PUBLIC_DIR), name=f"static{base_path or '_root'}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="VeriDataPro Tools", lifespan=lifespan)

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return JSONResponse(status_code=404, content={"error": "Not found."})
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.exception_handler(Exception)
    async def _unhandled(request, exc: Exception):
        logger.exception("Unhandled error")
        return JSONResponse(status_code=500, content={"error": "Unexpected server error."})

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/", include_in_schema=False)
    def root():
        # No tool lives at the root; send visitors to the tools directory.
        return RedirectResponse(url=f"{settings.docs_base}/", status_code=307)

    # API routers first so they take precedence over the static mounts.
    app.include_router(contact_router)
    app.include_router(build_mulesoft_router(settings.mulesoft_base))
    app.include_router(build_api_readiness_router(settings.api_readiness_base))
    app.include_router(build_integration_audit_router(settings.integration_audit_base))

    # Static + templated index for every tool.
    for setting_name, html_rel_path in STATIC_TOOLS:
        register_static_tool(app, getattr(settings, setting_name), html_rel_path)

    return app


app = create_app()
