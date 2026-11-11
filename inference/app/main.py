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
from collections.abc import Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app import nose, weights

# RN-17: a entrada é uma imagem de até 8 MB.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

_REQUEST_ID_HEADER = "X-Request-Id"

_logger = logging.getLogger("inference")


class _Body(BaseModel):
    """A JSON body with the names in camelCase, as in the API."""

    model_config = ConfigDict(
        alias_generator=to_camel, validate_by_name=True, protected_namespaces=()
    )


class Embedding(_Body):
    embedding: list[float]
    model_version: str
    quality: float


class ModelInfo(_Body):
    model_version: str
    dimensions: int


class Error(BaseModel):
    error: str
    message: str


def _load_extractor() -> nose.Extractor:
    """Loads the extractor that the environment variables describe."""
    models_dir = Path(os.environ.get("MODELS_DIR", "models"))
    threads = int(os.environ.get("INFERENCE_THREADS", "2"))
    if threads < 1:
        raise ValueError(f"INFERENCE_THREADS is {threads}, want 1 or more")
    return nose.Extractor(models_dir, threads)


def _refusal(status: int, error: str, message: str) -> JSONResponse:
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

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.extractor = await asyncio.to_thread(load_extractor)
        yield

    app = FastAPI(title="Nupii inference", version=weights.MODEL_VERSION, lifespan=lifespan)
    # RN-23: o serviço executa uma inferência por vez. A request that waits
    # stays in the event loop and does not use a thread.
    one_at_a_time = asyncio.Lock()

    @app.middleware("http")
    async def log_request(request: Request, call_next) -> Response:
        # RNF-07: the identifier comes from the API, so the log lines of the
        # two services have the same value.
        request_id = request.headers.get(_REQUEST_ID_HEADER) or str(uuid.uuid4())
        start = time.perf_counter()
        response = await call_next(request)
        response.headers[_REQUEST_ID_HEADER] = request_id
        _logger.info(
            json.dumps(
                {
                    "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "level": "INFO",
                    "msg": "request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - start) * 1000),
                }
            )
        )
        return response

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/model-info")
    async def model_info() -> ModelInfo:
        return ModelInfo(model_version=weights.MODEL_VERSION, dimensions=nose.EMBEDDING_DIMENSIONS)

    @app.post(
        "/v1/nose/embedding",
        response_model=Embedding,
        responses={400: {"model": Error}, 413: {"model": Error}, 422: {"model": Error}},
    )
    async def embedding(request: Request) -> Embedding | JSONResponse:
        data = await _read_body(request)
        if data is None:
            return _refusal(413, "image_too_large", "the image has more than 8 MB")
        try:
            async with one_at_a_time:
                vector, quality = await asyncio.to_thread(app.state.extractor.extract, data)
        except nose.InvalidImageError:
            return _refusal(400, "image_invalid", "the body is not an image that can be read")
        except nose.LowQualityError:
            return _refusal(422, "image_low_quality", "the image is not sharp enough")
        except nose.NoNoseError:
            return _refusal(422, "image_framing", "the detector found no nose in the image")
        return Embedding(
            embedding=vector.tolist(),
            model_version=weights.MODEL_VERSION,
            quality=round(quality, 4),
        )

    return app


logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(message)s")
app = create_app()
