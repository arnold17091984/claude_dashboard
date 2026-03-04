#!/usr/bin/env bash
# Build the claude-dashboard Docker image.
#
# Usage:
#   bash scripts/docker-build.sh              # builds :latest
#   bash scripts/docker-build.sh 1.2.3        # builds :1.2.3 and :latest
#   bash scripts/docker-build.sh 1.2.3 --push # builds and pushes to registry
#
# Environment variables:
#   IMAGE_NAME   Override the image name (default: claude-dashboard)
#   REGISTRY     Optional registry prefix, e.g. ghcr.io/myorg
#   PLATFORM     Target platform(s) (default: linux/amd64)
#                Use linux/amd64,linux/arm64 for multi-arch builds

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
IMAGE_NAME="${IMAGE_NAME:-claude-dashboard}"
REGISTRY="${REGISTRY:-}"
PLATFORM="${PLATFORM:-linux/amd64}"
VERSION="${1:-}"
PUSH=false

# Check for --push flag in any argument position
for arg in "$@"; do
  if [[ "$arg" == "--push" ]]; then
    PUSH=true
  fi
done

# Resolve the fully-qualified image name (registry prefix is optional)
if [[ -n "$REGISTRY" ]]; then
  FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}"
else
  FULL_IMAGE="${IMAGE_NAME}"
fi

# Build the list of tags
TAGS=("${FULL_IMAGE}:latest")
if [[ -n "$VERSION" && "$VERSION" != "--push" ]]; then
  TAGS+=("${FULL_IMAGE}:${VERSION}")
fi

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo "============================================"
echo "  claude-dashboard Docker build"
echo "============================================"
echo "  Image  : ${FULL_IMAGE}"
echo "  Tags   : ${TAGS[*]}"
echo "  Platform: ${PLATFORM}"
echo "  Push   : ${PUSH}"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Require BuildKit for multi-stage cache efficiency
# ---------------------------------------------------------------------------
export DOCKER_BUILDKIT=1

# ---------------------------------------------------------------------------
# Assemble the docker build command
# ---------------------------------------------------------------------------
BUILD_ARGS=(
  "build"
  "--file" "Dockerfile"
  "--platform" "${PLATFORM}"
)

for tag in "${TAGS[@]}"; do
  BUILD_ARGS+=("--tag" "${tag}")
done

if [[ "$PUSH" == true ]]; then
  BUILD_ARGS+=("--push")
fi

# Build context is the repository root (one level up from scripts/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ARGS+=("${REPO_ROOT}")

# ---------------------------------------------------------------------------
# Run the build
# ---------------------------------------------------------------------------
echo "Running: docker ${BUILD_ARGS[*]}"
echo ""
docker "${BUILD_ARGS[@]}"

echo ""
echo "Build complete."
for tag in "${TAGS[@]}"; do
  echo "  docker run -p 3000:3000 --env-file .env -v ./data:/app/data ${tag}"
done
