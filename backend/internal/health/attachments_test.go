package health

import (
	"errors"
	"strings"
	"testing"
)

func TestCheckAttachment(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		wantType string
		wantErr  bool
	}{
		{name: "RN-82 JPEG", data: []byte("\xFF\xD8\xFF\xE0 photo"), wantType: "image/jpeg"},
		{name: "RN-82 PDF", data: []byte("%PDF-1.7\n result"), wantType: "application/pdf"},
		{name: "RN-82 text file", data: []byte("a text file"), wantErr: true},
		{name: "RN-82 file with 10 MB", data: append([]byte("%PDF-1.7\n"), make([]byte, 10<<20-9)...),
			wantType: "application/pdf"},
		{name: "RN-82 file with more than 10 MB", data: append([]byte("%PDF-1.7\n"), make([]byte, 10<<20-8)...),
			wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			contentType, _, err := checkAttachment(tt.data)
			if tt.wantErr {
				if _, ok := errors.AsType[*ValidationError](err); !ok {
					t.Errorf("error = %v, want a ValidationError", err)
				}
				return
			}
			if err != nil || contentType != tt.wantType {
				t.Errorf("checkAttachment = %q, %v, want %q", contentType, err, tt.wantType)
			}
		})
	}
}

func TestFileName(t *testing.T) {
	tests := map[string]string{
		"exame.pdf":                  "exame.pdf",
		"  /tmp/../../exame.pdf ":    "exame.pdf",
		"":                           "anexo",
		"   ":                        "anexo",
		strings.Repeat("ã", 130):     strings.Repeat("ã", 120),
		`C:\Users\Ana\resultado.pdf`: "resultado.pdf",
	}
	for input, want := range tests {
		if got := fileName(input); got != want {
			t.Errorf("fileName(%q) = %q, want %q", input, got, want)
		}
	}
}
