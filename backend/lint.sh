#!/bin/sh
# Lint of the backend: formatting with gofmt and static checks with go vet.
# Run it in the backend directory. It ends with an error on the first problem.
set -eu

unformatted=$(gofmt -l .)
if [ -n "$unformatted" ]; then
	echo "gofmt: these files are not formatted (run: gofmt -w .):" >&2
	echo "$unformatted" >&2
	exit 1
fi

go vet ./...
# The integration tests have a build tag, so vet needs a second run for them.
go vet -tags=integration ./...
