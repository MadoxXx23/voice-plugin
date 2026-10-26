package engine

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestCaptureUntilStopAndCleanup(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell fixture is Unix-only")
	}
	dir := t.TempDir()
	fake := filepath.Join(dir, "fake-sox")
	// A fake SoX that writes a WAV-sized payload, then waits for SIGINT.
	script := "#!/bin/sh\ntrap 'exit 0' INT\nfor arg; do output=$arg; case \"$arg\" in *.wav) break;; esac; done\ndd if=/dev/zero of=\"$output\" bs=200 count=1 2>/dev/null\nwhile :; do sleep 0.1; done\n"
	if err := os.WriteFile(fake, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	audio := filepath.Join(dir, "speech.wav")
	engine := Engine{Config: Config{SoX: fake}}
	var ready bytes.Buffer
	err := engine.CaptureUntil(context.Background(), audio, strings.NewReader("\n"), &ready)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ready.String(), "READY") {
		t.Fatalf("missing handshake %q", ready.String())
	}
	if info, err := os.Stat(audio); err != nil || info.Size() != 200 {
		t.Fatalf("recording: %v %v", info, err)
	}
}
