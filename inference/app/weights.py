"""The weight files of the model: names, version and SHA-256 (RN-19, RN-22).

This module uses only the standard library, so the download script can run it
before the dependencies are installed:

    python3 -m app.weights models
"""

import hashlib
import sys
from pathlib import Path

# The label stored with each vector. A vector is comparable only with vectors
# of the same version.
MODEL_VERSION = "tinyvit21m-s43"

EMBEDDER = "tinyvit21m_s43.onnx"
DETECTOR = "nose_detector_yolo11n.onnx"

_SHA256 = {
    EMBEDDER: "979733b5e2bad2241cc1cf5f7a41d20ad444f173ae7ccbb962e22964ec6b248f",
    DETECTOR: "b685cb6ef9667797dd063a4045cb4a453dafbb2b8f1cc3879bbae90950b117de",
}


class WeightsError(RuntimeError):
    """A weight file does not exist or is not the file of the model version."""


def check(models_dir: Path) -> None:
    """Raises WeightsError when a weight file of models_dir does not exist or
    has another SHA-256 (RN-22)."""
    for name, expected in _SHA256.items():
        path = models_dir / name
        if not path.is_file():
            raise WeightsError(f"weight file not found: {path}")
        with path.open("rb") as file:
            actual = hashlib.file_digest(file, "sha256").hexdigest()
        if actual != expected:
            raise WeightsError(f"SHA-256 of {path} is {actual}, want {expected}")


if __name__ == "__main__":
    try:
        check(Path(sys.argv[1]))
    except WeightsError as error:
        sys.exit(str(error))
    print(f"weight files of {MODEL_VERSION}: SHA-256 OK")
