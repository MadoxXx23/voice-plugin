package transport

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/voice-agent/voice-agent/internal/engine"
)

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}
type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}
type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Serve accepts newline-delimited JSON-RPC 2.0. Each request is handled serially;
// one active operation per process. Cancel by terminating the subprocess.
func Serve(ctx context.Context, in io.Reader, out io.Writer, e engine.Engine) error {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 4096), 16*1024*1024)
	enc := json.NewEncoder(out)
	var mu sync.Mutex
	for scanner.Scan() {
		var req request
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			mu.Lock()
			_ = enc.Encode(response{JSONRPC: "2.0", Error: &rpcError{-32700, "parse error"}})
			mu.Unlock()
			continue
		}
		if req.JSONRPC != "2.0" || req.Method == "" {
			mu.Lock()
			_ = enc.Encode(response{JSONRPC: "2.0", ID: req.ID, Error: &rpcError{-32600, "invalid request"}})
			mu.Unlock()
			continue
		}
		if len(req.ID) == 0 {
			continue
		}
		result, err := dispatch(ctx, req, e)
		resp := response{JSONRPC: "2.0", ID: req.ID, Result: result}
		if err != nil {
			resp.Result = nil
			resp.Error = &rpcError{-32000, err.Error()}
		}
		mu.Lock()
		writeErr := enc.Encode(resp)
		mu.Unlock()
		if writeErr != nil {
			return writeErr
		}
	}
	return scanner.Err()
}
func dispatch(ctx context.Context, r request, e engine.Engine) (any, error) {
	var p struct {
		Text            string  `json:"text"`
		Path            string  `json:"path"`
		DurationSeconds float64 `json:"durationSeconds"`
	}
	if len(r.Params) > 0 && string(r.Params) != "null" {
		if err := json.Unmarshal(r.Params, &p); err != nil {
			return nil, fmt.Errorf("invalid params: %w", err)
		}
	}
	switch r.Method {
	case "voice.ping":
		return map[string]string{"status": "ok", "protocol": "1"}, nil
	case "voice.doctor":
		return e.Doctor(), nil
	case "voice.record":
		if p.DurationSeconds > 0 {
			if p.DurationSeconds > 600 {
				return nil, fmt.Errorf("duration must be <= 600 seconds")
			}
			e.Config.Duration = time.Duration(p.DurationSeconds * float64(time.Second))
		}
		text, err := e.Record(ctx)
		return map[string]string{"text": text}, err
	case "voice.transcribe":
		if strings.TrimSpace(p.Path) == "" {
			return nil, fmt.Errorf("path is required")
		}
		text, err := e.Transcribe(ctx, p.Path)
		return map[string]string{"text": text}, err
	case "voice.speak":
		err := e.Speak(ctx, p.Text)
		return map[string]bool{"ok": err == nil}, err
	default:
		return nil, fmt.Errorf("method not found: %s", strconv.Quote(r.Method))
	}
}
