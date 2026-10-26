package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type Config struct {
	WhisperModel, PiperModel, SoX, Whisper, Piper, Player string
	STTLanguage                                           string
	STTTranslate                                          bool
	Duration                                              time.Duration
}
type Engine struct{ Config Config }

func DefaultConfig() Config {
	cfg := Config{PiperModel: os.Getenv("PIPER_MODEL"), SoX: env("VOICE_SOX", "sox"), Whisper: env("VOICE_WHISPER", "whisper-cli"), Piper: env("VOICE_PIPER", "piper"), Player: env("VOICE_PLAYER", "play"), Duration: 8 * time.Second, STTLanguage: "auto"}
	path := os.Getenv("VOICE_PLUGIN_CONFIG")
	if path == "" && runtime.GOOS == "darwin" {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, "Library", "Application Support", "VoicePlugin", "config.json")
		}
	}
	if path != "" {
		if data, err := os.ReadFile(path); err == nil {
			var file struct {
				STT struct {
					ModelPath string `json:"modelPath"`
					Language  string `json:"language"`
					Translate bool   `json:"translate"`
				} `json:"stt"`
			}
			if json.Unmarshal(data, &file) == nil {
				cfg.WhisperModel = file.STT.ModelPath
				if file.STT.Language != "" {
					cfg.STTLanguage = file.STT.Language
				}
				cfg.STTTranslate = file.STT.Translate
			}
		}
	}
	if v := os.Getenv("WHISPER_MODEL"); v != "" {
		cfg.WhisperModel = v
	}
	return cfg
}

func whisperArgs(cfg Config, input, prefix string) ([]string, error) {
	language := cfg.STTLanguage
	if language == "" {
		language = "auto"
	}
	if language != "auto" {
		if len(language) < 2 || len(language) > 8 {
			return nil, fmt.Errorf("invalid STT language: %q", language)
		}
		for _, r := range language {
			if r < 'a' || r > 'z' {
				return nil, fmt.Errorf("invalid STT language: %q", language)
			}
		}
	}
	args := []string{"-m", cfg.WhisperModel, "-f", input, "-otxt", "-of", prefix, "-l", language}
	if cfg.STTTranslate {
		args = append(args, "-tr")
	}
	return args, nil
}
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func run(ctx context.Context, bin string, args ...string) error {
	cmd := exec.CommandContext(ctx, bin, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s failed: %w: %s", bin, err, strings.TrimSpace(string(out)))
	}
	return nil
}
func (e Engine) Transcribe(ctx context.Context, input string) (string, error) {
	if e.Config.WhisperModel == "" {
		return "", errors.New("WHISPER_MODEL is required")
	}
	if _, err := os.Stat(input); err != nil {
		return "", err
	}
	dir, err := os.MkdirTemp("", "voice-plugin-whisper-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(dir)
	prefix := filepath.Join(dir, "transcript")
	args, err := whisperArgs(e.Config, input, prefix)
	if err != nil {
		return "", err
	}
	if err := run(ctx, e.Config.Whisper, args...); err != nil {
		return "", err
	}
	data, err := os.ReadFile(prefix + ".txt")
	if err != nil {
		return "", fmt.Errorf("whisper output: %w", err)
	}
	return strings.TrimSpace(string(data)), nil
}
func (e Engine) Record(ctx context.Context) (string, error) {
	if e.Config.Duration <= 0 || e.Config.Duration > time.Minute*10 {
		return "", errors.New("invalid recording duration")
	}
	dir, err := os.MkdirTemp("", "voice-plugin-record-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(dir)
	audio := filepath.Join(dir, "recording.wav")
	if err := run(ctx, e.Config.SoX, "-d", "-r", "16000", "-c", "1", "-b", "16", audio, "trim", "0", fmt.Sprintf("%.2f", e.Config.Duration.Seconds())); err != nil {
		return "", err
	}
	return e.Transcribe(ctx, audio)
}
func (e Engine) Speak(ctx context.Context, message string) error {
	if strings.TrimSpace(message) == "" {
		return errors.New("text must not be empty")
	}
	if e.Config.PiperModel == "" {
		return errors.New("PIPER_MODEL is required")
	}
	dir, err := os.MkdirTemp("", "voice-plugin-speak-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	audio := filepath.Join(dir, "speech.wav")
	cmd := exec.CommandContext(ctx, e.Config.Piper, "--model", e.Config.PiperModel, "--output_file", audio)
	cmd.Stdin = strings.NewReader(message)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("piper failed: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return run(ctx, e.Config.Player, audio)
}
func (e Engine) Doctor() map[string]any {
	results := map[string]any{}
	for k, cmd := range map[string]string{"sox": e.Config.SoX, "whisper": e.Config.Whisper, "piper": e.Config.Piper, "player": e.Config.Player} {
		_, err := exec.LookPath(cmd)
		results[k] = err == nil
	}
	results["whisper_model_set"] = e.Config.WhisperModel != ""
	if e.Config.WhisperModel != "" {
		_, err := os.Stat(e.Config.WhisperModel)
		results["whisper_model_exists"] = err == nil
	} else {
		results["whisper_model_exists"] = false
	}
	results["piper_model_set"] = e.Config.PiperModel != ""
	return results
}
