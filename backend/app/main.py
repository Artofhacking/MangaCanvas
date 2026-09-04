from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import Base, SessionLocal, engine
from .errors import ApiError, api_error_handler
from .routers import (
    ai,
    assets,
    auth,
    billing,
    catalog,
    credits,
    health,
    orgs,
    projects,
    upload,
    users,
    workflows,
)
from .seed import seed_if_empty

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_if_empty(db)
    db.commit()

settings.upload_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="MangaCanvas API", version="2.0", redirect_slashes=False)
app.add_exception_handler(ApiError, api_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={"code": 1001, "message": f"参数错误：{exc.errors()[0].get('msg', 'invalid')}", "data": None},
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"
app.include_router(health.router, prefix=API)
app.include_router(auth.router, prefix=API)
app.include_router(users.router, prefix=API)
app.include_router(orgs.router, prefix=API)
app.include_router(projects.router, prefix=API)
app.include_router(catalog.router, prefix=API)
app.include_router(workflows.router, prefix=API)
app.include_router(assets.router, prefix=API)
app.include_router(upload.router, prefix=API)
app.include_router(credits.router, prefix=API)
app.include_router(billing.router, prefix=API)
app.include_router(ai.router, prefix=API)

app.mount("/static/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")
