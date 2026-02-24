#!/bin/bash
set -e
# Copy rill-lang into build context (Docker can't access paths outside context)
# Path is relative to project root: ../../ goes up to home, then into Projects/rill-lang
# (Note: package.json uses ../../ because npm resolves from the package.json directory, not project root)
mkdir -p .docker-deps/rill-lang
cp -r ../../Projects/rill-lang/dist .docker-deps/rill-lang/dist
cp ../../Projects/rill-lang/package.json .docker-deps/rill-lang/package.json
docker build -t rill-job-tracker .
