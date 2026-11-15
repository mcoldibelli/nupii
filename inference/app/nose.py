"""From the bytes of a photo to the vector of a nose (RN-18 to RN-21): the
detector finds the nose in the photo, and the vector comes from the crop of
the nose (#292)."""

import io
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

from app import weights

EMBEDDING_DIMENSIONS = 512  # RN-18
MIN_QUALITY = 0.20  # RN-20
MIN_NOSE_CONFIDENCE = 0.25  # RN-21
# RN-21: the crop of the nose has at least the side that the embedder reads.
MIN_NOSE_SIDE = 224
# The crop is the box of the detector times this value. The photos of the
# calibration of the model are the nose alone: this margin keeps all the nose
# in the crop, and it gave the best result in the measure of #292.
NOSE_MARGIN = 1.5
# The label of the vectors (RN-10, RN-67). It is not the label of the weight
# files: the same weights with another pre-processing give other vectors.
VECTOR_VERSION = f"{weights.MODEL_VERSION}-crop"
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
        return ImageOps.exif_transpose(image).convert("RGB")
    except InvalidImageError:
        raise
    except Exception as error:
        # The bytes come from outside, and the readers of the image formats
        # raise many types of error for a damaged file: OSError, SyntaxError,
        # ValueError and others. All of them mean the same for the caller.
        raise InvalidImageError(f"{type(error).__name__}: {error}") from error


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
    ratio, left, top = _detector_place(image)
    # A very thin image keeps one pixel of width or of height.
    width = max(1, round(image.width * ratio))
    height = max(1, round(image.height * ratio))
    square = Image.new("RGB", (_DETECTOR_SIDE, _DETECTOR_SIDE), _PADDING_GRAY)
    square.paste(image.resize((width, height), Image.Resampling.BILINEAR), (left, top))
    return (np.asarray(square, dtype=np.float32) / 255.0).transpose(2, 0, 1)[None]


def _detector_place(image: Image.Image) -> tuple[float, int, int]:
    """Returns the scale of the image in the 640 square, and its left and top."""
    ratio = min(_DETECTOR_SIDE / image.width, _DETECTOR_SIDE / image.height)
    width = max(1, round(image.width * ratio))
    height = max(1, round(image.height * ratio))
    left = round((_DETECTOR_SIDE - width) / 2 - 0.1)
    top = round((_DETECTOR_SIDE - height) / 2 - 0.1)
    return ratio, left, top


@dataclass(frozen=True)
class NoseBox:
    """The nose that the detector found, in pixels of the photo."""

    center_x: float
    center_y: float
    side: float
    confidence: float


def crop_box(image: Image.Image, box: NoseBox) -> tuple[int, int, int, int]:
    """Returns the square around the nose: the side of the box times
    NOSE_MARGIN, at most the short side of the photo, moved inside the photo."""
    side = min(box.side * NOSE_MARGIN, image.width, image.height)
    left = min(max(box.center_x - side / 2, 0), image.width - side)
    top = min(max(box.center_y - side / 2, 0), image.height - side)
    return round(left), round(top), round(left + side), round(top + side)


def nose_crop(image: Image.Image, box: NoseBox) -> Image.Image:
    """Returns the crop of the nose, in the pixels of the photo (#292)."""
    return image.crop(crop_box(image, box))


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
        sharpness = quality(embedder_pixels(image))
        if sharpness < MIN_QUALITY:
            raise LowQualityError(f"quality {sharpness:.4f}")
        box = self.nose_box(image)
        if box.confidence < MIN_NOSE_CONFIDENCE:
            raise NoNoseError("the detector found no nose")
        # The vector comes from the nose, and not from the whole photo (#292).
        crop = nose_crop(image, box)
        if crop.width < MIN_NOSE_SIDE:
            raise NoNoseError(
                f"the crop of the nose has {crop.width} pixels, less than {MIN_NOSE_SIDE}"
            )
        return self.embed(embedder_pixels(crop)), sharpness

    def nose_confidence(self, image: Image.Image) -> float:
        """Returns the confidence of the detector that the image has a nose."""
        return self.nose_box(image).confidence

    def nose_box(self, image: Image.Image) -> NoseBox:
        """Returns the box of the detector with the highest confidence, in
        pixels of the photo."""
        # The output has a column for each candidate box: the center x and y,
        # the width and the height in the 640 square, and the confidence of
        # the only class.
        output = _run(self._detector, detector_pixels(image))[0]
        best = int(output[4].argmax())
        center_x, center_y, width, height, confidence = (
            float(value) for value in output[:5, best]
        )
        ratio, left, top = _detector_place(image)
        return NoseBox(
            (center_x - left) / ratio,
            (center_y - top) / ratio,
            max(width, height) / ratio,
            confidence,
        )

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
