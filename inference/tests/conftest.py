import os
from pathlib import Path

import pytest

from app import nose

DATA = Path(__file__).parent / "data"
SYNTHETIC = DATA / "synthetic"
MODELS_DIR = Path(os.environ.get("MODELS_DIR", Path(__file__).parent.parent / "models"))


@pytest.fixture(scope="session")
def extractor() -> nose.Extractor:
    """The extractor with the real weight files. The tests that use it fail
    when the files are not in the models directory: see download_weights.sh."""
    return nose.Extractor(MODELS_DIR, threads=2)
