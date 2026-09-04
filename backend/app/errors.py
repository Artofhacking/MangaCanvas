from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: int, message: str, http_status: int = 400):
        self.code = code
        self.message = message
        self.http_status = http_status


def fail(code: int, message: str, http_status: int = 400) -> None:
    raise ApiError(code, message, http_status)


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content={"code": exc.code, "message": exc.message, "data": None},
    )


def ok(data, status: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": 0, "data": data})
