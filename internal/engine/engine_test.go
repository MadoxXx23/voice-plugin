package engine

import (
	"context"
	"strings"
	"testing"
)

func TestRequiresModel(t *testing.T) {
	e := Engine{Config: Config{}}
	_, err := e.Transcribe(context.Background(), "x.wav")
	if err == nil || !strings.Contains(err.Error(), "WHISPER_MODEL") {
		t.Fatal(err)
	}
}
func TestEmptySpeech(t *testing.T) {
	e := Engine{}
	if err := e.Speak(context.Background(), " "); err == nil {
		t.Fatal("expected error")
	}
}
