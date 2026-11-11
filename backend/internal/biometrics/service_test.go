package biometrics

import "testing"

func TestVectorText(t *testing.T) {
	tests := []struct {
		name   string
		vector []float32
		want   string
	}{
		{name: "values with the shortest text that gives the same float32",
			vector: []float32{0.1, -0.25, 1, 0}, want: "[0.1,-0.25,1,0]"},
		{name: "very small value", vector: []float32{1e-7}, want: "[1e-07]"},
		{name: "no value", vector: nil, want: "[]"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := vectorText(tt.vector); got != tt.want {
				t.Errorf("vectorText = %q, want %q", got, tt.want)
			}
		})
	}
}
