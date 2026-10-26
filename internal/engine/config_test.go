package engine

import (
	"os"
	"path/filepath"
	"testing"
)

func TestModelConfigAndEnvOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	if err := os.WriteFile(path, []byte(`{"stt":{"modelPath":"/tmp/default-model.bin"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("VOICE_AGENT_CONFIG", path)
	t.Setenv("WHISPER_MODEL", "")
	if got := DefaultConfig().WhisperModel; got != "/tmp/default-model.bin" {
		t.Fatalf("got %q", got)
	}
	t.Setenv("WHISPER_MODEL", "/tmp/override.bin")
	if got := DefaultConfig().WhisperModel; got != "/tmp/override.bin" {
		t.Fatalf("override got %q", got)
	}
}
