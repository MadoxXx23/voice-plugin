# Voice Agent

Local voice input for OpenCode. Record speech, transcribe it with whisper.cpp, and insert the result into the OpenCode input field **without sending the message**.

Audio is processed locally. The current installation guide targets macOS; Linux and Windows integrations are not yet fully verified.

## Install (macOS)

Requires OpenCode v2, Node.js 20+, Homebrew and microphone access for your terminal.

```sh
brew install sox whisper-cpp
node scripts/install-macos.mjs
~/.local/bin/voice-agent doctor
```

The installer downloads a multilingual Whisper model on first setup. After installation, restart OpenCode.

## Use

Run **`/r`** in OpenCode to start recording; run **`/r`** again to stop. The recognized text is inserted into the draft. Review or edit it before pressing Enter.

Run **`/voice-doctor`** to check recording and transcription dependencies. If microphone capture fails, enable microphone access for your terminal in macOS System Settings.

## Update

From the unpacked new release:

```sh
node scripts/update.mjs
```

Restart OpenCode after updating. The updater preserves your existing configuration and model.

## Language settings

Edit `~/Library/Application Support/VoiceAgent/config.json` and **keep your existing modelPath**:

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
| `~/.local/bin/voice-agent` | Voice engine |
| `~/.config/opencode/voice-agent-plugin/` | OpenCode adapter |
| `~/Library/Application Support/VoiceAgent/config.json` | Voice settings |

## Development

Go core: `cmd/`, `internal/`. OpenCode adapter: `adapters/opencode/`. Install/update scripts: `scripts/`. Technical architecture: `docs/adr/`.

```sh
go test ./...
node --test scripts/*.test.mjs
```

**Compatibility:** draft insertion depends on OpenTUI internals and still requires verification against the installed OpenCode build.
