#!/bin/sh
# Downloads the weight files of the model from the release of the repository
# and checks the SHA-256 of each file (RN-22).
# It needs the GitHub CLI (gh) with access to the repository, and python3.
set -eu
cd "$(dirname "$0")"

# The tag of the release has the model version, which is in app/weights.py.
version=$(python3 -c "from app import weights; print(weights.MODEL_VERSION)")
gh release download "model-$version" --dir models --clobber
python3 -m app.weights models
