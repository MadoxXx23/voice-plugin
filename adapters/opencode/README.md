# OpenCode adapter

Connects the OpenCode TUI to the local Voice Plugin executable.

Use `/r` to start or stop recording. Transcribed text is placed in the input draft; it is not sent automatically. Use `/voice-doctor` to inspect dependencies.

Install from the repository root with `node scripts/install-macos.mjs`; update with `node scripts/update.mjs`. See the [main README](../../README.md) for setup and language settings.

For development, install the adapter at a stable path and register that path in the `plugins` array of `~/.config/opencode/cli.json`. The adapter requires the `voice-plugin` executable, SoX, whisper.cpp, and a configured model.
