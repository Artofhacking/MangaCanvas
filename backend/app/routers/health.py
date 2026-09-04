import time

from fastapi import APIRouter

from ..errors import ok

router = APIRouter()


@router.get("/health")
def health():
    return ok({"status": "ok", "timestamp": int(time.time() * 1000)})
