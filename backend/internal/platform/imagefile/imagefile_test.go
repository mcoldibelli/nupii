package imagefile

import "testing"

func TestType(t *testing.T) {
	tests := []struct {
		name          string
		data          string
		wantType      string
		wantExtension string
	}{
		{name: "JPEG", data: "\xFF\xD8\xFF\xE0", wantType: "image/jpeg", wantExtension: "jpg"},
		{name: "PNG", data: "\x89PNG\x0D\x0A\x1A\x0A", wantType: "image/png", wantExtension: "png"},
		{name: "WebP", data: "RIFF\x00\x00\x00\x00WEBPVP", wantType: "image/webp", wantExtension: "webp"},
		{name: "GIF", data: "GIF89a"},
		{name: "text", data: "this is a text file"},
		{name: "empty"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			contentType, extension, ok := Type([]byte(tt.data))
			if contentType != tt.wantType || extension != tt.wantExtension || ok != (tt.wantType != "") {
				t.Errorf("Type = %q, %q, %v, want %q, %q", contentType, extension, ok,
					tt.wantType, tt.wantExtension)
			}
		})
	}
}
