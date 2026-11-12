package main

import (
	"testing"
	"time"
)

// RN-42: todo dia às 3h, no fuso de Brasília.
func TestNextPurge(t *testing.T) {
	brasilia, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Fatalf("load the time zone: %v", err)
	}
	for _, c := range []struct{ now, want string }{
		{"2026-11-11T02:00:00-03:00", "2026-11-11T03:00:00-03:00"},
		{"2026-11-11T03:00:00-03:00", "2026-11-12T03:00:00-03:00"},
		{"2026-11-11T23:30:00-03:00", "2026-11-12T03:00:00-03:00"},
		// 05:30 UTC is 02:30 in Brasília.
		{"2026-11-11T05:30:00Z", "2026-11-11T03:00:00-03:00"},
	} {
		now, err := time.Parse(time.RFC3339, c.now)
		if err != nil {
			t.Fatalf("parse %q: %v", c.now, err)
		}
		want, err := time.Parse(time.RFC3339, c.want)
		if err != nil {
			t.Fatalf("parse %q: %v", c.want, err)
		}
		if got := nextPurge(now); !got.Equal(want) || got.Location().String() != brasilia.String() {
			t.Errorf("nextPurge(%s) = %s, want %s", c.now, got, c.want)
		}
	}
}
