import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, code: int, message: str, http_status: int = 400, headers: dict[str, str] | None = None):
        self.code = code
        self.message = message
        self.http_status = http_status
        self.headers = headers or {}


def fail(code: int, message: str, http_status: int = 400, headers: dict[str, str] | None = None) -> None:
    raise ApiError(code, message, http_status, headers)


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content={"code": exc.code, "message": exc.message, "data": None},
        headers=exc.headers,
    )


def ok(data, status: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": 0, "data": data})


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    message = "invalid"
    if exc.errors():
        message = exc.errors()[0].get("msg", "invalid")
    return JSONResponse(
        status_code=400,
        content={"code": 1001, "message": f"参数错误：{message}", "data": None},
    )


async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled api error")
    detail = str(exc).strip() or exc.__class__.__name__
    return JSONResponse(
        status_code=500,
        content={"code": 5000, "message": f"服务器内部错误: {detail}", "data": None},
    )
