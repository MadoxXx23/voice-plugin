package engine

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

// CaptureUntil records microphone audio until stop is signalled through stdin.
// The caller owns the output file and must remove it after transcription.
func (e Engine) CaptureUntil(ctx context.Context, output string, stop io.Reader, ready io.Writer) error {
	if output == "" {
		return errors.New("output WAV path is required")
	}
	if err := os.MkdirAll(filepath.Dir(output), 0700); err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, e.Config.SoX, "-d", "-r", "16000", "-c", "1", "-b", "16", output, "trim", "0", "600")
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err = cmd.Start(); err != nil {
		return fmt.Errorf("start SoX: %w", err)
	}
	processDone := make(chan error, 1)
	go func() { _, _ = io.Copy(io.Discard, stderr); processDone <- cmd.Wait() }()
	// A started process is not necessarily capturing yet. Wait for audio bytes.
	deadline := time.NewTimer(5 * time.Second)
	tick := time.NewTicker(25 * time.Millisecond)
	defer deadline.Stop()
	defer tick.Stop()
readyLoop:
	for {
		select {
		case err := <-processDone:
			return fmt.Errorf("SoX exited before recording started: %v", err)
		case <-ctx.Done():
			_ = cmd.Process.Kill()
			<-processDone
			return ctx.Err()
		case <-deadline.C:
			_ = cmd.Process.Kill()
			<-processDone
			return errors.New("timed out waiting for microphone audio")
		case <-tick.C:
			if info, statErr := os.Stat(output); statErr == nil && info.Size() > 44 {
				break readyLoop
			}
		}
	}
	if _, err = fmt.Fprintln(ready, "READY"); err != nil {
		_ = cmd.Process.Kill()
		<-processDone
		return err
	}
	stopped := make(chan struct{})
	go func() { var b [1]byte; _, _ = stop.Read(b[:]); close(stopped) }()
	var result error
	select {
	case result = <-processDone:
		if result == nil {
			return errors.New("capture ended before stop signal")
		}
		return fmt.Errorf("SoX stopped unexpectedly: %w", result)
	case <-ctx.Done():
		_ = cmd.Process.Kill()
		<-processDone
		return ctx.Err()
	case <-stopped:
		if runtime.GOOS == "windows" {
			_ = cmd.Process.Kill()
		} else {
			_ = cmd.Process.Signal(syscall.SIGINT)
		}
		select {
		case result = <-processDone:
		case <-time.After(3 * time.Second):
			_ = cmd.Process.Kill()
			result = <-processDone
		}
	}
	// SoX commonly exits with an interrupt status after a normal stop.
	_ = result
	info, err := os.Stat(output)
	if err != nil {
		return fmt.Errorf("audio missing after capture: %w", err)
	}
	if info.Size() <= 44 {
		return errors.New("recorded audio is empty")
	}
	return nil
}
