# Voice Plugin

Local voice input for OpenCode. Record speech, transcribe it with whisper.cpp, and insert the result into the OpenCode input field **without sending the message**.

Audio is processed locally. The current installation guide targets macOS; Linux and Windows integrations are not yet fully verified.

## Install (macOS)

Requires OpenCode v2, Node.js 20+, Homebrew and microphone access for your terminal.

```sh
brew install sox whisper-cpp
node scripts/install-macos.mjs
~/.local/bin/voice-plugin doctor
```

The installer downloads the matching Go binary from the GitHub Release (version taken from `adapters/opencode/package.json`) and a multilingual Whisper model on first setup. If `dist/releases` contains prebuilt archives (for example after `./scripts/release.sh`), they are used instead. The release repository is taken from the git `origin` remote or the `VOICE_PLUGIN_RELEASE_REPO` environment variable. After installation, restart OpenCode.

## Use

Run **`/r`** in OpenCode to start recording; run **`/r`** again to stop. The recognized text is inserted into the draft. Review or edit it before pressing Enter.

Run **`/voice-doctor`** to check recording and transcription dependencies. If microphone capture fails, enable microphone access for your terminal in macOS System Settings.

## Update

In the repository checkout at the new version:

```sh
git pull
node scripts/update.mjs
```

The updater installs the plugin from the checkout and the binary from the local `dist/releases` or the matching GitHub Release. Restart OpenCode after updating. The updater preserves your existing configuration and model.

## Language settings

Edit `~/Library/Application Support/VoicePlugin/config.json` and **keep your existing modelPath**:

```json
{
  "stt": {
    "modelPath": "/path/to/your/ggml-base.bin",
    "language": "en",
    "translate": false
  }
}
```

`language: "auto"` enables automatic language detection. `translate: false` transcribes without translating. Restart OpenCode after changing settings.

## Files

| Path | Purpose |
| --- | --- |
| `~/.local/bin/voice-plugin` | Voice engine |
| `~/.config/opencode/voice-plugin/` | OpenCode adapter |
| `~/Library/Application Support/VoicePlugin/config.json` | Voice settings |

## Release

Tag `v<version>` where the version matches `adapters/opencode/package.json`. CI runs the tests, builds the cross-architecture archives in `dist/releases` (not committed to the repo), and publishes the GitHub Release with the archives, `SHA256SUMS`, and the npm package. Build locally with `./scripts/release.sh [version]`.

## Development

Go core: `cmd/`, `internal/`. OpenCode adapter: `adapters/opencode/`. Install/update scripts: `scripts/`. Technical architecture: `docs/adr/`.

```sh
go test ./...
node --test scripts/*.test.mjs
cd adapters/opencode && npm install && npm test
```

**Compatibility:** draft insertion depends on OpenTUI internals and still requires verification against the installed OpenCode build.
