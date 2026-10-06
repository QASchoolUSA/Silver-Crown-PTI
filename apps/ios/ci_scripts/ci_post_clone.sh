#!/bin/sh
set -euo pipefail

# Xcode Cloud: ensure the Swift app project exists even if XcodeGen output
# was not present for some reason. Prefer the committed .xcodeproj.

ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
IOS_DIR="$ROOT/apps/ios"

cd "$IOS_DIR"

if [ ! -d "SilverCrown.xcodeproj" ]; then
  if command -v xcodegen >/dev/null 2>&1; then
    echo "SilverCrown.xcodeproj missing — generating with XcodeGen"
    xcodegen generate
  else
    echo "error: SilverCrown.xcodeproj is missing and xcodegen is not installed."
    echo "Commit apps/ios/SilverCrown.xcodeproj or install XcodeGen in CI."
    exit 1
  fi
else
  echo "Found apps/ios/SilverCrown.xcodeproj"
fi
