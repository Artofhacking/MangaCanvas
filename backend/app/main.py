import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import inspect, text

from . import billing_service
from .config import settings
from .db import Base, SessionLocal, engine
from .errors import ApiError, api_error_handler, unhandled_exception_handler, validation_error_handler
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
    scripts,
    upload,
    users,
    workflows,
)
from .schema_migrate import migrate_schema
from .seed import seed_demo_content, seed_if_empty, seed_price_rules

Base.metadata.create_all(bind=engine)
migrate_schema(engine)
try:
    inspector = inspect(engine)
    if "episodes" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("episodes")}
        if "cover_image" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE episodes ADD COLUMN cover_image VARCHAR(1024) NULL"))
        if "storyboard" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE episodes ADD COLUMN storyboard JSON"))
except Exception:
    pass
with SessionLocal() as db:
    seed_if_empty(db)
    seed_demo_content(db)
    seed_price_rules(db)
    db.commit()

settings.upload_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    stop = asyncio.Event()

    async def _sweep_loop():
        while not stop.is_set():
            try:
                await asyncio.to_thread(billing_service.sweep_once)
            except Exception:
                pass
            try:
                await asyncio.wait_for(stop.wait(), timeout=30)
            except asyncio.TimeoutError:
                continue

    task = asyncio.create_task(_sweep_loop())
    try:
        yield
    finally:
        stop.set()
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="MangaCanvas API", version="2.0", redirect_slashes=False, lifespan=lifespan)
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
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
app.include_router(scripts.router, prefix=API)
app.include_router(workflows.router, prefix=API)
app.include_router(assets.router, prefix=API)
app.include_router(upload.router, prefix=API)
app.include_router(credits.router, prefix=API)
app.include_router(billing.router, prefix=API)
app.include_router(ai.router, prefix=API)

app.mount("/static/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")
