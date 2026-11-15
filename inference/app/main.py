"""The HTTP interface of the inference service.

Run it with: uvicorn app.main:app
"""

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app import nose

# RN-17: a entrada é uma imagem de até 8 MB.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

_REQUEST_ID_HEADER = "X-Request-Id"
_ERROR_OF_STATUS = {404: "not_found", 405: "method_not_allowed"}

_logger = logging.getLogger("inference")


def _load_extractor() -> nose.Extractor:
    """Loads the extractor that the environment variables describe."""
    models_dir = Path(os.environ.get("MODELS_DIR", "models"))
    threads = os.environ.get("INFERENCE_THREADS", "2")
    if not threads.isdecimal() or int(threads) < 1:
        raise ValueError(f"INFERENCE_THREADS is {threads!r}, want a whole number from 1")
    return nose.Extractor(models_dir, int(threads))


def _error(status: int, error: str, message: str) -> JSONResponse:
    return JSONResponse({"error": error, "message": message}, status_code=status)


async def _read_body(request: Request) -> bytes | None:
    """Returns the body of the request, or None when it has more than RN-17 allows."""
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_IMAGE_BYTES:
            return None
    return bytes(data)


def create_app(load_extractor: Callable[[], nose.Extractor] = _load_extractor) -> FastAPI:
    """Returns the application. It loads the extractor when it starts, so the
    service does not start with a wrong weight file (RN-22)."""
    # RN-23: o serviço executa uma inferência por vez.
    # The executor has one thread, so a second inference cannot start before
    # the first one ends, also when the request of the first one is cancelled.
    # A request that waits stays in the event loop and does not use a thread.
    one_at_a_time = ThreadPoolExecutor(max_workers=1, thread_name_prefix="inference")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.extractor = await asyncio.to_thread(load_extractor)
        yield
        one_at_a_time.shutdown()

    # ADR 0007: the service has three paths. The documentation pages are off.
    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def log_request(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # RNF-07: the identifier comes from the API, so the log lines of the
        # two services have the same value.
        request_id = request.headers.get(_REQUEST_ID_HEADER) or str(uuid.uuid4())
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            _logger.exception("request failed, request_id %s", request_id)
            response = _error(500, "internal_error", "the service failed")
        response.headers[_REQUEST_ID_HEADER] = request_id
        line = {
            "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": "INFO",
            "msg": "request",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - start) * 1000),
        }
        if hasattr(request.state, "detail"):
            line["detail"] = request.state.detail
        _logger.info(json.dumps(line))
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        # An unknown path and a wrong method have the format of the other errors.
        name = _ERROR_OF_STATUS.get(error.status_code, "request_error")
        return _error(error.status_code, name, str(error.detail))

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/model-info")
    async def model_info() -> dict[str, str | int]:
        return {"modelVersion": nose.VECTOR_VERSION, "dimensions": nose.EMBEDDING_DIMENSIONS}

    @app.post("/v1/nose/embedding")
    async def embedding(request: Request) -> Response:
        data = await _read_body(request)
        if data is None:
            return _error(413, "image_too_large", "the image has more than 8 MB")
        loop = asyncio.get_running_loop()
        try:
            vector, quality = await loop.run_in_executor(
                one_at_a_time, app.state.extractor.extract, data
            )
        except nose.InvalidImageError as error:
            request.state.detail = str(error)
            return _error(400, "image_invalid", "the body is not an image that can be read")
        except nose.LowQualityError as error:
            request.state.detail = str(error)
            return _error(422, "image_low_quality", "the image is not sharp enough")
        except nose.NoNoseError as error:
            request.state.detail = str(error)
            return _error(422, "image_framing", "the detector found no nose in the image")
        return JSONResponse(
            {
                "embedding": vector.tolist(),
                "modelVersion": nose.VECTOR_VERSION,
                # RN-18: a nitidez tem 4 casas decimais.
                "quality": round(quality, 4),
            }
        )

    return app


logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(message)s")
app = create_app()
