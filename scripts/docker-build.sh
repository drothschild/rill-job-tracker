#!/bin/bash
set -e
# Copy rill-lang into build context (Docker can't access paths outside context)
mkdir -p .docker-deps/rill-lang
cp -r ../Projects/rill-lang/dist .docker-deps/rill-lang/dist
cp ../Projects/rill-lang/package.json .docker-deps/rill-lang/package.json
docker build -t rill-job-tracker .
