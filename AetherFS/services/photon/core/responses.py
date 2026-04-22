# Standard Libraries
from typing import Generic, TypeVar

# Third party Libraries
from pydantic import BaseModel
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


# T represents a flexible placeholder for any data type
T = TypeVar("T")


# Standard Response
class StandardResponse(BaseModel, Generic[T]):
    status: str = "success"
    detail: str | None = "Operation completed successfully"
    data: T | None = None


# Exception Handlers Setup
def setup_exception_handlers(app: FastAPI):
    # Override HTTP Error
    @app.exception_handler(StarletteHTTPException)
    async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "detail": str(exc.detail),
                "data": None
            }
        )

    # Override Validation Error
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        error_msg = f"Input parameter error in field '{errors[0]['loc'][-1]}': {errors[0]['msg']}" if errors else "Invalid data"

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": "error",
                "detail": error_msg,
                "data": {"validation_errors": errors}
            }
        )

    # Override Error
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "detail": "System error. Please try again later",
                "data": None
            }
        )
