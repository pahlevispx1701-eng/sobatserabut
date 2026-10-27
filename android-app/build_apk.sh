#!/usr/bin/env bash
# build_apk.sh - Wrapper delegasi ke build_both_apks.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/build_both_apks.sh" "$@"
