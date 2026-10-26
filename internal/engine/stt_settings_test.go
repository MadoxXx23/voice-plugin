package engine

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestSTTConfigFromJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(`{"stt":{"modelPath":"/tmp/model.bin","language":"ru","translate":false}}`), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("VOICE_PLUGIN_CONFIG", path)
	t.Setenv("WHISPER_MODEL", "")
	cfg := DefaultConfig()
	if cfg.WhisperModel != "/tmp/model.bin" || cfg.STTLanguage != "ru" || cfg.STTTranslate {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	args, err := whisperArgs(cfg, "recording.wav", "transcript")
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"-m", "/tmp/model.bin", "-f", "recording.wav", "-otxt", "-of", "transcript", "-l", "ru"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args = %v, want %v", args, want)
	}
}
func TestTranslateEnabled(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(`{"stt":{"language":"en","translate":true}}`), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("VOICE_PLUGIN_CONFIG", path)
	cfg := DefaultConfig()
	args, err := whisperArgs(cfg, "a.wav", "out")
	if err != nil || args[len(args)-1] != "-tr" {
		t.Fatalf("args=%v err=%v", args, err)
	}
}
func TestSTTDefaultsAndInvalidLanguage(t *testing.T) {
	t.Setenv("VOICE_PLUGIN_CONFIG", filepath.Join(t.TempDir(), "missing.json"))
	cfg := DefaultConfig()
	if cfg.STTLanguage != "auto" || cfg.STTTranslate {
		t.Fatalf("defaults: %+v", cfg)
	}
	cfg.STTLanguage = "ru;rm"
	if _, err := whisperArgs(cfg, "a", "b"); err == nil {
		t.Fatal("invalid language accepted")
	}
}
