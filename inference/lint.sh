#!/bin/sh
# Lint of the inference service: static checks and formatting with ruff.
# Run it in the inference directory, with the virtual environment active.
set -eu

ruff check .
ruff format --check .
