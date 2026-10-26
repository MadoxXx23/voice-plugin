#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
version="${1:-0.1.0-alpha.23}"
# Fail the release before touching artifacts if a plugin TS/TSX file does not parse.
node scripts/check-plugin-syntax.mjs
out="dist/releases"
mkdir -p "$out"
rm -f "$out"/*.tar.gz "$out"/*.zip "$out"/SHA256SUMS
for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64; do
  os="${target%/*}"; arch="${target#*/}"
  dir="$(mktemp -d)"
  suffix=""; [ "$os" != windows ] || suffix=".exe"
  GOOS="$os" GOARCH="$arch" CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o "$dir/voice-agent$suffix" ./cmd/voice-agent
  cp README.md "$dir/README.md"
  if [ "$os" = windows ]; then
    (cd "$dir" && zip -q "$OLDPWD/$out/voice-agent_${version}_${os}_${arch}.zip" "voice-agent$suffix" README.md)
  else
    tar -C "$dir" -czf "$out/voice-agent_${version}_${os}_${arch}.tar.gz" "voice-agent$suffix" README.md
  fi
  rm -rf "$dir"
done
(cd "$out" && sha256sum *.tar.gz *.zip > SHA256SUMS)
