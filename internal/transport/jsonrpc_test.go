package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/voice-plugin/voice-plugin/internal/engine"
	"strings"
	"testing"
)

func TestServePing(t *testing.T) {
	var out bytes.Buffer
	err := Serve(context.Background(), strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"voice.ping"}`+"\n"), &out, engine.Engine{Config: engine.DefaultConfig()})
	if err != nil {
		t.Fatal(err)
	}
	var response map[string]any
	if err := json.Unmarshal(out.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response["error"] != nil {
		t.Fatal(response)
	}
	if response["id"] != float64(1) {
		t.Fatal(response)
	}
}
func TestInvalidJSON(t *testing.T) {
	var out bytes.Buffer
	_ = Serve(context.Background(), strings.NewReader("bad\n"), &out, engine.Engine{})
	if !strings.Contains(out.String(), "-32700") {
		t.Fatal(out.String())
	}
}
func TestUnknownMethod(t *testing.T) {
	var out bytes.Buffer
	_ = Serve(context.Background(), strings.NewReader(`{"jsonrpc":"2.0","id":3,"method":"nope"}`+"\n"), &out, engine.Engine{})
	if !strings.Contains(out.String(), "method not found") {
		t.Fatal(out.String())
	}
}
