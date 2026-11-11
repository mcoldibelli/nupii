import hashlib
from pathlib import Path

import pytest

from app import weights


@pytest.fixture
def models_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A directory with two small files that have the expected SHA-256."""
    contents = {weights.EMBEDDER: b"embedder", weights.DETECTOR: b"detector"}
    for name, content in contents.items():
        (tmp_path / name).write_bytes(content)
    expected = {name: hashlib.sha256(content).hexdigest() for name, content in contents.items()}
    monkeypatch.setattr(weights, "_SHA256", expected)
    return tmp_path


def test_rn22_accepts_the_files_with_the_expected_sha256(models_dir: Path) -> None:
    weights.check(models_dir)


def test_rn22_refuses_a_file_with_another_sha256(models_dir: Path) -> None:
    (models_dir / weights.DETECTOR).write_bytes(b"another detector")

    with pytest.raises(weights.WeightsError, match="SHA-256"):
        weights.check(models_dir)


def test_rn22_refuses_a_directory_without_a_file(models_dir: Path) -> None:
    (models_dir / weights.EMBEDDER).unlink()

    with pytest.raises(weights.WeightsError, match="not found"):
        weights.check(models_dir)


def test_rn19_the_model_version_is_the_label_of_the_calibration() -> None:
    assert weights.MODEL_VERSION == "tinyvit21m-s43"
