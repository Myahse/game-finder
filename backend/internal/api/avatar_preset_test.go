package api

import "testing"

func TestIsAvatarPresetURL(t *testing.T) {
	if !isAvatarPresetURL("preset:v1.s2.h1.j4") {
		t.Fatal("expected valid v1 preset")
	}
	if !isAvatarPresetURL("preset:v2.s2.b1.z1.h1.a0.o0.j4") {
		t.Fatal("expected valid v2 preset")
	}
	if isAvatarPresetURL("preset:v1.bad.h1.j4") {
		t.Fatal("invalid skin")
	}
	if isAvatarPresetURL("https://evil.com/avatar/x") {
		t.Fatal("reject url")
	}
	if isAvatarPresetURL("preset:v1.s0.h0") {
		t.Fatal("reject short preset")
	}
}
