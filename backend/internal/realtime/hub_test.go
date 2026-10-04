package realtime

import "testing"

func TestNormConnUserID(t *testing.T) {
	const id = "7f2be1ba-95f5-4810-a171-623f14ee29d5"
	if normConnUserID(" "+id+" ") != id {
		t.Fatalf("trim/lowercase failed")
	}
	upper := "7F2BE1BA-95F5-4810-A171-623F14EE29D5"
	if normConnUserID(upper) != id {
		t.Fatalf("uppercase normalize: got %q", normConnUserID(upper))
	}
}
