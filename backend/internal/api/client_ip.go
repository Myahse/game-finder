package api

import (
	"net"
	"net/http"
	"strings"
)

// clientIP returns the caller IP. X-Real-IP is honored only when the TCP peer is a trusted proxy.
func (s *Server) clientIP(r *http.Request) string {
	remote, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remote = r.RemoteAddr
	}
	if s.peerIsTrustedProxy(remote) {
		if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
			return ip
		}
	}
	return remote
}

func (s *Server) peerIsTrustedProxy(host string) bool {
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	for _, n := range s.trustedProxies {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}
