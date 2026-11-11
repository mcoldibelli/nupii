import io

import numpy as np
import pytest
from PIL import Image

from app import nose

from .conftest import SYNTHETIC


def png(image: Image.Image, **options: object) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "PNG", **options)
    return buffer.getvalue()


def test_rn58_applies_the_rotation_of_the_exif_data() -> None:
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: the viewer turns the image 90 degrees.
    wide = Image.new("RGB", (20, 10), (255, 0, 0))

    image = nose.open_image(png(wide, exif=exif))

    assert image.size == (10, 20)


def test_open_image_converts_to_rgb() -> None:
    assert nose.open_image(png(Image.new("LA", (4, 4)))).mode == "RGB"


@pytest.mark.parametrize("data", [b"", b"this is a text file", b"\x89PNG\r\n\x1a\n cut"])
def test_rn17_refuses_bytes_that_are_not_an_image(data: bytes) -> None:
    with pytest.raises(nose.InvalidImageError):
        nose.open_image(data)


def test_rn17_refuses_an_image_file_with_damaged_content() -> None:
    # The file is a PNG with 3 bytes changed. The reader of the image fails
    # with an error that is not an error of input and output.
    damaged = bytearray((SYNTHETIC / "05-checker.png").read_bytes())
    damaged[36], damaged[342], damaged[373] = 90, 37, 104

    with pytest.raises(nose.InvalidImageError):
        nose.open_image(bytes(damaged))


def test_rn57_accepts_an_image_with_50_million_pixels() -> None:
    # A one-color image is a small PNG file.
    assert nose.open_image(png(Image.new("L", (10_000, 5_000)))).size == (10_000, 5_000)


def test_rn57_refuses_an_image_with_more_than_50_million_pixels() -> None:
    too_many = png(Image.new("L", (10_000, 5_001)))

    with pytest.raises(nose.InvalidImageError, match="pixels"):
        nose.open_image(too_many)


def test_embedder_pixels_have_the_shape_and_the_range_of_the_network() -> None:
    pixels = nose.embedder_pixels(Image.new("RGB", (640, 480), (255, 0, 51)))

    assert pixels.shape == (3, 224, 224) and pixels.dtype == np.float32
    assert pixels[0].min() == 1.0 and pixels[1].max() == 0.0
    assert pixels[2, 0, 0] == pytest.approx(0.2)


def test_rn20_an_image_of_one_color_has_quality_zero() -> None:
    assert nose.quality(np.full((3, 224, 224), 0.5, dtype=np.float32)) == 0.0


def test_rn20_quality_is_the_laplacian_variance_divided_by_the_reference() -> None:
    # One bright pixel in the center of a 4 x 4 image. The laplacian without
    # padding has 4 values: -4 at the pixel, 1 beside it, 1 below it, and 0.
    gray = np.zeros((4, 4), dtype=np.float32)
    gray[1, 1] = 0.01
    pixels = np.stack([gray, gray, gray])
    # Values -0.04, 0.01, 0.01, 0: mean -0.005, sum of squares 0.0017,
    # variance with N-1 = 0.0017 / 3.
    expected = (0.0017 / 3) / 0.000832

    assert nose.quality(pixels) == pytest.approx(expected, rel=1e-5)


def test_rn20_quality_has_a_maximum_of_one() -> None:
    noise = np.random.default_rng(1).random((3, 224, 224), dtype=np.float32)

    assert nose.quality(noise) == 1.0


def test_detector_pixels_of_a_very_thin_image_keep_one_pixel() -> None:
    # 2 x 3000 pixels: the width in the square would round to 0.
    pixels = nose.detector_pixels(Image.new("RGB", (2, 3000), (255, 255, 255)))

    assert pixels.shape == (1, 3, 640, 640)
    assert (pixels[0] == 1.0).any()


def test_detector_pixels_put_the_image_in_the_center_of_a_gray_square() -> None:
    pixels = nose.detector_pixels(Image.new("RGB", (200, 100), (255, 255, 255)))

    assert pixels.shape == (1, 3, 640, 640) and pixels.dtype == np.float32
    gray = np.float32(114 / 255)
    # The image has 640 x 320 pixels, with 160 gray rows over it and under it.
    assert (pixels[0, :, :160] == gray).all() and (pixels[0, :, 480:] == gray).all()
    assert (pixels[0, :, 160:480] == 1.0).all()


class StubExtractor(nose.Extractor):
    """An extractor without the networks, with a fixed answer of the detector."""

    def __init__(self, confidence: float) -> None:
        self._confidence = confidence

    def nose_confidence(self, image: Image.Image) -> float:
        return self._confidence

    def embed(self, pixels: np.ndarray) -> np.ndarray:
        return np.zeros(nose.EMBEDDING_DIMENSIONS, dtype=np.float32)


_PHOTO = png(Image.new("RGB", (32, 32)))


def test_rn20_refuses_a_quality_below_0_20(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nose, "quality", lambda pixels: 0.1999)

    with pytest.raises(nose.LowQualityError):
        StubExtractor(confidence=1.0).extract(_PHOTO)


def test_rn20_accepts_a_quality_of_0_20(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nose, "quality", lambda pixels: 0.20)

    _, quality = StubExtractor(confidence=1.0).extract(_PHOTO)

    assert quality == 0.20


def test_rn21_refuses_a_confidence_below_0_25(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nose, "quality", lambda pixels: 1.0)

    with pytest.raises(nose.NoNoseError):
        StubExtractor(confidence=0.2499).extract(_PHOTO)


def test_rn21_accepts_a_confidence_of_0_25(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nose, "quality", lambda pixels: 1.0)

    vector, _ = StubExtractor(confidence=0.25).extract(_PHOTO)

    assert vector.shape == (512,)


def test_rn20_the_quality_is_checked_before_the_framing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nose, "quality", lambda pixels: 0.0)

    with pytest.raises(nose.LowQualityError):
        StubExtractor(confidence=0.0).extract(_PHOTO)
