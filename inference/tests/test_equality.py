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
    """Applies the criterion of ADR 0019: the same decision of quality (RN-20,
    limit 0.20) and of framing (RN-21, limit 0.25), and a cosine of at least
    0.9999 for an image that is accepted."""
    data = (directory / want["name"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == want["sha256"], "this is not the file of reference"

    if want["quality"] < 0.20:
        with pytest.raises(nose.LowQualityError):
            extractor.extract(data)
    elif want["nose_confidence"] < 0.25:
        with pytest.raises(nose.NoNoseError):
            extractor.extract(data)
    else:
        embedding, _ = extractor.extract(data)
        assert float(embedding @ want["embedding"]) >= _MIN_COSINE


def _check_vector(extractor: nose.Extractor, directory: Path, want: dict) -> None:
    """Compares the vector of an image that the service refuses. The refusal
    comes before the vector, so this check calls the steps one by one."""
    pixels = nose.embedder_pixels(nose.open_image((directory / want["name"]).read_bytes()))
    embedding = extractor.embed(pixels)

    assert embedding.shape == (512,), "RN-18: 512 dimensions"
    assert np.linalg.norm(embedding) == pytest.approx(1.0, abs=1e-5), "RN-18: L2 norm of 1"
    assert float(embedding @ want["embedding"]) >= _MIN_COSINE


_SYNTHETIC = _reference("synthetic.npz")
_REAL_PHOTOS = _reference("real_photos.npz")


def test_the_synthetic_set_has_all_the_decisions() -> None:
    low_quality = [r for r in _SYNTHETIC if r["quality"] < 0.20]
    no_nose = [r for r in _SYNTHETIC if r["nose_confidence"] < 0.25]

    assert len(_SYNTHETIC) == 16 and len(low_quality) == 4 and len(no_nose) == 14


@pytest.mark.parametrize("want", _SYNTHETIC, ids=[r["name"] for r in _SYNTHETIC])
def test_synthetic_image_gives_the_values_of_reference(
    extractor: nose.Extractor, want: dict
) -> None:
    _check(extractor, SYNTHETIC, want)


@pytest.mark.parametrize("want", _SYNTHETIC, ids=[r["name"] for r in _SYNTHETIC])
def test_synthetic_image_gives_the_vector_of_reference(
    extractor: nose.Extractor, want: dict
) -> None:
    _check_vector(extractor, SYNTHETIC, want)


def test_rn19_the_vector_of_an_image_is_the_vector_of_its_mirror(
    extractor: nose.Extractor,
) -> None:
    # The vector is the sum of the image and of its mirror, so the mirror of
    # the image gives the same sum.
    image = nose.open_image((SYNTHETIC / "06-texture.png").read_bytes())
    pixels = nose.embedder_pixels(image)
    mirrored = np.ascontiguousarray(pixels[:, :, ::-1])

    assert float(extractor.embed(pixels) @ extractor.embed(mirrored)) >= 0.999999


@pytest.mark.real_photos
@pytest.mark.parametrize("want", _REAL_PHOTOS, ids=[r["name"] for r in _REAL_PHOTOS])
def test_real_photo_gives_the_values_of_reference(extractor: nose.Extractor, want: dict) -> None:
    # Without the variable, the test fails: a KeyError names the variable.
    directory = Path(os.environ["NOSE_PHOTOS_DIR"])
    _check(extractor, directory, want)
    _check_vector(extractor, directory, want)
