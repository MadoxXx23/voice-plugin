#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
# Version comes from the argument, or from the package manifest (single source of truth,
# so archive names always match the npm package and the plugin version).
version="${1:-$(node -p "require('./adapters/opencode/package.json').version")}"
case "$version" in
  *[!a-zA-Z0-9.-]*) echo "Invalid version: $version" >&2; exit 1 ;;
esac
# Fail the release before touching artifacts if a plugin TS/TSX file does not parse.
node scripts/check-plugin-syntax.mjs
out="dist/releases"
mkdir -p "$out"
rm -f "$out"/*.tar.gz "$out"/*.zip "$out"/SHA256SUMS
for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64; do
  os="${target%/*}"; arch="${target#*/}"
  dir="$(mktemp -d)"
  suffix=""; [ "$os" != windows ] || suffix=".exe"
  GOOS="$os" GOARCH="$arch" CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o "$dir/voice-plugin$suffix" ./cmd/voice-plugin
  cp README.md "$dir/README.md"
  if [ "$os" = windows ]; then
    (cd "$dir" && zip -q "$OLDPWD/$out/voice-plugin_${version}_${os}_${arch}.zip" "voice-plugin$suffix" README.md)
  else
    tar -C "$dir" -czf "$out/voice-plugin_${version}_${os}_${arch}.tar.gz" "voice-plugin$suffix" README.md
  fi
  rm -rf "$dir"
done
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$out" && sha256sum *.tar.gz *.zip > SHA256SUMS)
else
  (cd "$out" && for f in *.tar.gz *.zip; do echo "$(shasum -a 256 "$f" | cut -d' ' -f1)  $f"; done > SHA256SUMS)
fi
echo "Built release $version in $out"
