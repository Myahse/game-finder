package api

import "testing"

func TestClientIPFromForwarded(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"", ""},
		{"203.0.113.10", "203.0.113.10"},
		{"203.0.113.10, 10.0.0.1", "203.0.113.10"},
		{"  198.51.100.2 , 10.0.0.1", "198.51.100.2"},
		{"not-an-ip", ""},
	}
	for _, tc := range tests {
		if got := clientIPFromForwarded(tc.in); got != tc.want {
			t.Fatalf("clientIPFromForwarded(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
