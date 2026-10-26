package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/voice-plugin/voice-plugin/internal/engine"
	"github.com/voice-plugin/voice-plugin/internal/transport"
	"os"
	"os/signal"
	"strconv"
	"time"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "voice-plugin:", err)
		os.Exit(1)
	}
}
func run(args []string) error {
	e := engine.Engine{Config: engine.DefaultConfig()}
	ctx := context.Background()
	if len(args) == 0 {
		return fmt.Errorf("usage: voice-plugin <serve|doctor|record|capture|transcribe|speak> [args]")
	}
	switch args[0] {
	case "serve":
		return transport.Serve(ctx, os.Stdin, os.Stdout, e)
	case "doctor":
		return json.NewEncoder(os.Stdout).Encode(e.Doctor())
	case "record":
		if len(args) > 1 {
			seconds, err := strconv.ParseFloat(args[1], 64)
			if err != nil {
				return err
			}
			e.Config.Duration = time.Duration(seconds * float64(time.Second))
		}
		s, err := e.Record(ctx)
		if err == nil {
			fmt.Println(s)
		}
		return err
	case "capture":
		if len(args) < 2 {
			return fmt.Errorf("provide output WAV path")
		}
		captureCtx, cancel := signal.NotifyContext(ctx, os.Interrupt)
		defer cancel()
		return e.CaptureUntil(captureCtx, args[1], os.Stdin, os.Stdout)
	case "transcribe":
		if len(args) < 2 {
			return fmt.Errorf("provide path to WAV")
		}
		s, err := e.Transcribe(ctx, args[1])
		if err == nil {
			fmt.Println(s)
		}
		return err
	case "speak":
		if len(args) < 2 {
			return fmt.Errorf("provide text")
		}
		return e.Speak(ctx, args[1])
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}
