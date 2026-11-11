import asyncio
import threading
import time
from pathlib import Path

import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import main, nose, weights

from .conftest import MODELS_DIR, SYNTHETIC


@pytest.fixture(scope="module")
def client(extractor: nose.Extractor):
    with TestClient(main.create_app(lambda: extractor)) as client:
        yield client


def post(client: TestClient, data: bytes) -> httpx.Response:
    return client.post("/v1/nose/embedding", content=data)


def test_rn18_gives_the_vector_the_model_version_and_the_quality(client: TestClient) -> None:
    # The only synthetic image that the detector accepts.
    response = post(client, (SYNTHETIC / "11-texture-gray.png").read_bytes())

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"embedding", "modelVersion", "quality"}
    assert len(body["embedding"]) == 512
    assert np.linalg.norm(body["embedding"]) == pytest.approx(1.0, abs=1e-5)
    assert body["modelVersion"] == "tinyvit21m-s43"
    assert body["quality"] == 1.0


@pytest.mark.parametrize(
    ("name", "status", "error"),
    [
        pytest.param("04-flat-gray.png", 422, "image_low_quality", id="RN-20 no sharpness"),
        # This image has no sharpness and the detector finds a nose in it:
        # the quality is checked first.
        pytest.param("15-texture-blurred.jpg", 422, "image_low_quality", id="RN-20 comes first"),
        pytest.param("01-noise.png", 422, "image_framing", id="RN-21 no nose"),
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
    assert response.json() == {"modelVersion": "tinyvit21m-s43", "dimensions": 512}


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
