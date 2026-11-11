"""The service gives the vector of reference of the model (ADR 0007, ADR 0019).

The reference values come from the pre-processing of reference of the model.
The thresholds of RN-13 and RN-15 are valid only while this test passes.
"""

import hashlib
import os
from pathlib import Path

import numpy as np
import pytest

from app import nose

from .conftest import DATA, SYNTHETIC

_MIN_COSINE = 0.9999


def _reference(name: str) -> list[dict]:
    with np.load(DATA / name) as data:
        return [
            {
                "name": str(data["names"][i]),
                "sha256": str(data["sha256"][i]),
                "embedding": data["embeddings"][i],
                "quality": float(data["quality"][i]),
                "nose_confidence": float(data["nose_confidence"][i]),
            }
            for i in range(len(data["names"]))
        ]


def _check(extractor: nose.Extractor, directory: Path, want: dict) -> None:
    data = (directory / want["name"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == want["sha256"], "this is not the file of reference"

    image = nose.open_image(data)
    pixels = nose.embedder_pixels(image)
    quality = nose.quality(pixels)
    confidence = extractor.nose_confidence(image)
    embedding = extractor.embed(pixels)

    assert embedding.shape == (nose.EMBEDDING_DIMENSIONS,)
    assert np.linalg.norm(embedding) == pytest.approx(1.0, abs=1e-5), "RN-18: L2 norm"
    assert float(embedding @ want["embedding"]) >= _MIN_COSINE
    # RN-20 and RN-21: the same values, so the same decisions.
    assert quality == pytest.approx(want["quality"], rel=1e-4, abs=1e-6)
    assert (quality < nose.MIN_QUALITY) == (want["quality"] < nose.MIN_QUALITY)
    assert confidence == pytest.approx(want["nose_confidence"], abs=1e-3)
    assert (confidence < nose.MIN_NOSE_CONFIDENCE) == (
        want["nose_confidence"] < nose.MIN_NOSE_CONFIDENCE
    )


_SYNTHETIC = _reference("synthetic.npz")
_REAL_PHOTOS = _reference("real_photos.npz")


def test_the_synthetic_set_has_all_the_decisions() -> None:
    low_quality = [r for r in _SYNTHETIC if r["quality"] < nose.MIN_QUALITY]
    no_nose = [r for r in _SYNTHETIC if r["nose_confidence"] < nose.MIN_NOSE_CONFIDENCE]

    assert len(_SYNTHETIC) == 16 and len(low_quality) == 4 and len(no_nose) == 14


@pytest.mark.parametrize("want", _SYNTHETIC, ids=[r["name"] for r in _SYNTHETIC])
def test_synthetic_image_gives_the_values_of_reference(
    extractor: nose.Extractor, want: dict
) -> None:
    _check(extractor, SYNTHETIC, want)


@pytest.mark.real_photos
@pytest.mark.parametrize("want", _REAL_PHOTOS, ids=[r["name"] for r in _REAL_PHOTOS])
def test_real_photo_gives_the_values_of_reference(extractor: nose.Extractor, want: dict) -> None:
    # Without the variable, the test fails: a KeyError names the variable.
    _check(extractor, Path(os.environ["NOSE_PHOTOS_DIR"]), want)
