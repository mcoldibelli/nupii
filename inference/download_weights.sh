#!/bin/sh
# Downloads the weight files of the model from the release of the repository
# and checks the SHA-256 of each file (RN-22).
# It needs the GitHub CLI (gh) with access to the repository, and python3.
set -eu
cd "$(dirname "$0")"

gh release download model-tinyvit21m-s43 --repo mcoldibelli/nupii --dir models --clobber
python3 -m app.weights models
