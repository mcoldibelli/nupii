"""From the bytes of a photo to the vector of a nose (RN-18 to RN-21)."""

import io
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps, UnidentifiedImageError

from app import weights

EMBEDDING_DIMENSIONS = 512  # RN-18
MIN_QUALITY = 0.20  # RN-20
MIN_NOSE_CONFIDENCE = 0.25  # RN-21
# RN-57: a imagem tem no máximo 50 milhões de pixels.
MAX_PIXELS = 50_000_000

_EMBEDDER_SIDE = 224
_DETECTOR_SIDE = 640
_SHARPNESS_REFERENCE = 0.000832  # RN-20
# Mean and standard deviation of ImageNet, the values of the training.
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)
# The detector was trained with this gray around the image.
_PADDING_GRAY = (114, 114, 114)


class InvalidImageError(ValueError):
    """The bytes are not an image that the service can read."""


class LowQualityError(ValueError):
    """The image is not sharp enough for the biometrics (RN-20)."""


class NoNoseError(ValueError):
    """The detector did not find a nose in the image (RN-21)."""


def open_image(data: bytes) -> Image.Image:
    """Returns the image in RGB, with the rotation of the EXIF data applied.

    A phone stores the pixels as the sensor gives them and writes the rotation
    in the EXIF data. Without the rotation, the photo of the registration and
    the photo of the search are not comparable.
    """
    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > MAX_PIXELS:
            raise InvalidImageError(f"the image has more than {MAX_PIXELS} pixels")
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise InvalidImageError(str(error)) from error
    return ImageOps.exif_transpose(image).convert("RGB")


def embedder_pixels(image: Image.Image) -> np.ndarray:
    """Returns the image as the embedder reads it: 3 x 224 x 224, from 0 to 1."""
    resized = image.resize((_EMBEDDER_SIDE, _EMBEDDER_SIDE), Image.Resampling.BILINEAR)
    return (np.asarray(resized, dtype=np.float32) / 255.0).transpose(2, 0, 1)


def quality(pixels: np.ndarray) -> float:
    """Returns the sharpness of the image, from 0 to 1 (RN-20)."""
    gray = pixels.mean(axis=0)
    # The laplacian has no padding: a padding of zeros makes an edge around
    # the image, and that edge would be most of the variance.
    laplacian = (
        gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
        - 4.0 * gray[1:-1, 1:-1]
    )
    # ddof=1: the calibration of RN-20 used the variance that divides by N-1.
    return min(1.0, float(laplacian.var(ddof=1)) / _SHARPNESS_REFERENCE)


def detector_pixels(image: Image.Image) -> np.ndarray:
    """Returns the image as the detector reads it: 1 x 3 x 640 x 640, from 0 to 1.

    The image keeps its proportions and goes to the center of a gray square.
    The rounding of the position is the rounding of the training of the
    detector: another position changes the confidence.
    """
    ratio = min(_DETECTOR_SIDE / image.width, _DETECTOR_SIDE / image.height)
    width, height = round(image.width * ratio), round(image.height * ratio)
    square = Image.new("RGB", (_DETECTOR_SIDE, _DETECTOR_SIDE), _PADDING_GRAY)
    left = round((_DETECTOR_SIDE - width) / 2 - 0.1)
    top = round((_DETECTOR_SIDE - height) / 2 - 0.1)
    square.paste(image.resize((width, height), Image.Resampling.BILINEAR), (left, top))
    return (np.asarray(square, dtype=np.float32) / 255.0).transpose(2, 0, 1)[None]


def _normalized(vectors: np.ndarray) -> np.ndarray:
    return vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-12)


class Extractor:
    """The two networks of the service: the nose detector and the embedder."""

    def __init__(self, models_dir: Path, threads: int) -> None:
        """Loads the weight files of models_dir. Raises weights.WeightsError
        when a file does not exist or has another SHA-256 (RN-22)."""
        weights.check(models_dir)
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        self._embedder = _session(models_dir / weights.EMBEDDER, options)
        self._detector = _session(models_dir / weights.DETECTOR, options)

    def extract(self, data: bytes) -> tuple[np.ndarray, float]:
        """Returns the vector and the quality of the photo in data.

        Raises InvalidImageError, LowQualityError or NoNoseError when the
        photo is refused. The quality is checked before the framing (RN-20).
        """
        image = open_image(data)
        pixels = embedder_pixels(image)
        sharpness = quality(pixels)
        if sharpness < MIN_QUALITY:
            raise LowQualityError(f"quality {sharpness:.4f}")
        if self.nose_confidence(image) < MIN_NOSE_CONFIDENCE:
            raise NoNoseError("the detector found no nose")
        return self.embed(pixels), sharpness

    def nose_confidence(self, image: Image.Image) -> float:
        """Returns the confidence of the detector that the image has a nose."""
        # Row 4 of the output has the confidence of the only class, for each
        # candidate box. The service needs only to know if a nose exists.
        return float(_run(self._detector, detector_pixels(image))[0, 4].max())

    def embed(self, pixels: np.ndarray) -> np.ndarray:
        """Returns the vector of the image, with L2 norm 1 (RN-18, RN-19)."""
        batch = ((pixels - _MEAN) / _STD)[None]
        mirrored = np.ascontiguousarray(batch[:, :, :, ::-1])
        vectors = _run(self._embedder, batch) + _run(self._embedder, mirrored)
        return _normalized(vectors)[0]


def _session(path: Path, options: ort.SessionOptions) -> ort.InferenceSession:
    return ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])


def _run(session: ort.InferenceSession, pixels: np.ndarray) -> np.ndarray:
    return session.run(None, {session.get_inputs()[0].name: pixels})[0]
