#!/bin/bash
set -e
# Copy rill-lang into build context (Docker can't access paths outside context).
# rill-lang is a sibling of this repo (both under Projects/), so ../rill-lang.
rm -rf .docker-deps/rill-lang
mkdir -p .docker-deps/rill-lang
cp -r ../rill-lang/dist .docker-deps/rill-lang/dist
cp ../rill-lang/package.json .docker-deps/rill-lang/package.json
docker build -t rill-job-tracker .
