import asyncio
import json
import logging
import threading
import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import main, nose, weights

from .conftest import MODELS_DIR, SYNTHETIC


@pytest.fixture(scope="module")
def client(extractor: nose.Extractor) -> Iterator[TestClient]:
    with TestClient(main.create_app(lambda: extractor)) as client:
        yield client


def post(client: TestClient, data: bytes) -> httpx.Response:
    return client.post("/v1/nose/embedding", content=data)


def test_rn18_gives_the_vector_the_model_version_and_the_quality(client: TestClient) -> None:
    # The synthetic image that the detector accepts, large enough for the crop of the nose.
    response = post(client, (SYNTHETIC / "17-texture-gray-large.png").read_bytes())

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"embedding", "modelVersion", "quality"}
    assert len(body["embedding"]) == 512
    assert np.linalg.norm(body["embedding"]) == pytest.approx(1.0, abs=1e-5)
    assert body["modelVersion"] == "tinyvit21m-s43-crop"
    assert body["quality"] == 1.0


@pytest.mark.parametrize(
    ("name", "status", "error"),
    [
        pytest.param("04-flat-gray.png", 422, "image_low_quality", id="RN-20 no sharpness"),
        # This image has no sharpness and the detector finds a nose in it:
        # the quality is checked first.
        pytest.param("15-texture-blurred.jpg", 422, "image_low_quality", id="RN-20 comes first"),
        pytest.param("01-noise.png", 422, "image_framing", id="RN-21 no nose"),
        pytest.param("11-texture-gray.png", 422, "image_framing", id="RN-21 nose too small"),
    ],
)
def test_refuses_a_photo_that_the_biometrics_cannot_use(
    client: TestClient, name: str, status: int, error: str
) -> None:
    response = post(client, (SYNTHETIC / name).read_bytes())

    assert response.status_code == status
    assert response.json()["error"] == error and response.json()["message"]


def test_rn17_refuses_a_body_that_is_not_an_image(client: TestClient) -> None:
    response = post(client, b"this is a text file")

    assert response.status_code == 400 and response.json()["error"] == "image_invalid"


def test_rn17_refuses_a_body_with_more_than_8_mb(client: TestClient) -> None:
    response = post(client, bytes(8 * 1024 * 1024 + 1))

    assert response.status_code == 413 and response.json()["error"] == "image_too_large"


def test_rn17_a_body_with_8_mb_is_read(client: TestClient) -> None:
    response = post(client, bytes(8 * 1024 * 1024))

    assert response.status_code == 400 and response.json()["error"] == "image_invalid"


def test_model_info(client: TestClient) -> None:
    response = client.get("/v1/model-info")

    assert response.status_code == 200
    assert response.json() == {"modelVersion": "tinyvit21m-s43-crop", "dimensions": 512}


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200 and response.json() == {"status": "ok"}


def test_rnf07_the_answer_has_the_request_id_of_the_caller(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-Id": "request-123"})

    assert response.headers["X-Request-Id"] == "request-123"


def test_rn22_the_service_does_not_start_with_a_wrong_weight_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / weights.EMBEDDER).write_bytes(b"not the model")
    (tmp_path / weights.DETECTOR).write_bytes((MODELS_DIR / weights.DETECTOR).read_bytes())
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))

    with pytest.raises(weights.WeightsError, match="SHA-256"), TestClient(main.create_app()):
        pass


class FixedExtractor:
    """Gives a fixed quality, or raises a fixed error."""

    def __init__(self, quality: float = 1.0, error: Exception | None = None) -> None:
        self._quality = quality
        self._error = error

    def extract(self, data: bytes) -> tuple[np.ndarray, float]:
        if self._error is not None:
            raise self._error
        return np.zeros(512, dtype=np.float32), self._quality


def test_rn18_the_quality_has_4_decimal_places() -> None:
    with TestClient(main.create_app(lambda: FixedExtractor(quality=0.123456789))) as client:
        assert post(client, b"photo").json()["quality"] == 0.1235


def test_a_failure_of_the_service_gives_500_and_a_log_line_with_the_request_id(
    caplog: pytest.LogCaptureFixture,
) -> None:
    broken = FixedExtractor(error=RuntimeError("the network failed"))
    with (
        caplog.at_level(logging.INFO, logger="inference"),
        TestClient(main.create_app(lambda: broken)) as client,
    ):
        response = client.post(
            "/v1/nose/embedding", content=b"photo", headers={"X-Request-Id": "request-500"}
        )

    assert response.status_code == 500 and response.json()["error"] == "internal_error"
    assert response.headers["X-Request-Id"] == "request-500"
    # RNF-07: the line of the request has the identifier and the status.
    line = json.loads(caplog.records[-1].getMessage())
    assert line["request_id"] == "request-500" and line["status"] == 500


def test_the_log_line_of_a_refusal_has_the_cause(caplog: pytest.LogCaptureFixture) -> None:
    refused = FixedExtractor(error=nose.LowQualityError("quality 0.1234"))
    with (
        caplog.at_level(logging.INFO, logger="inference"),
        TestClient(main.create_app(lambda: refused)) as client,
    ):
        assert post(client, b"photo").status_code == 422

    line = json.loads(caplog.records[-1].getMessage())
    assert line["status"] == 422 and line["detail"] == "quality 0.1234"


@pytest.mark.parametrize(
    ("method", "path", "status", "error"),
    [
        ("GET", "/v1/unknown", 404, "not_found"),
        ("GET", "/v1/nose/embedding", 405, "method_not_allowed"),
        # ADR 0007: the service has three paths, and no documentation pages.
        ("GET", "/docs", 404, "not_found"),
        ("GET", "/redoc", 404, "not_found"),
        ("GET", "/openapi.json", 404, "not_found"),
    ],
)
def test_every_error_has_the_format_of_the_contract(
    client: TestClient, method: str, path: str, status: int, error: str
) -> None:
    response = client.request(method, path)

    assert response.status_code == status
    assert response.json()["error"] == error and response.json()["message"]


def test_the_number_of_threads_must_be_a_whole_number(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INFERENCE_THREADS", "two")

    with pytest.raises(ValueError, match="INFERENCE_THREADS"), TestClient(main.create_app()):
        pass


class SlowExtractor:
    """Counts the calls of extract that run at the same time."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._running = 0
        self.most_at_the_same_time = 0

    def extract(self, data: bytes) -> tuple[np.ndarray, float]:
        with self._lock:
            self._running += 1
            self.most_at_the_same_time = max(self.most_at_the_same_time, self._running)
        time.sleep(0.05)
        with self._lock:
            self._running -= 1
        return np.zeros(512, dtype=np.float32), 1.0


def test_rn23_runs_one_inference_at_a_time() -> None:
    slow = SlowExtractor()
    app = main.create_app(lambda: slow)
    app.state.extractor = slow

    async def four_requests() -> list[httpx.Response]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            calls = [client.post("/v1/nose/embedding", content=b"photo") for _ in range(4)]
            return await asyncio.gather(*calls)

    responses = asyncio.run(four_requests())

    assert [r.status_code for r in responses] == [200] * 4
    assert slow.most_at_the_same_time == 1


def test_rn23_a_cancelled_request_does_not_let_two_inferences_run() -> None:
    slow = SlowExtractor()
    app = main.create_app(lambda: slow)
    app.state.extractor = slow

    async def cancel_the_first_request() -> None:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            first = asyncio.create_task(client.post("/v1/nose/embedding", content=b"photo"))
            await asyncio.sleep(0.02)  # The first inference is running.
            first.cancel()
            second = await client.post("/v1/nose/embedding", content=b"photo")
            assert second.status_code == 200

    asyncio.run(cancel_the_first_request())

    assert slow.most_at_the_same_time == 1
