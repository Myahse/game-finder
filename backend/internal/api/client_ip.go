package api

import (
	"net"
	"net/http"
	"strings"
)

// clientIP returns the caller IP. Forwarded headers are honored only when the TCP peer is a trusted proxy.
func (s *Server) clientIP(r *http.Request) string {
	remote, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remote = r.RemoteAddr
	}
	if s.peerIsTrustedProxy(remote) {
		if ip := clientIPFromForwarded(r.Header.Get("X-Forwarded-For")); ip != "" {
			return ip
		}
		if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
			if parsed := net.ParseIP(ip); parsed != nil {
				return ip
			}
		}
	}
	return remote
}

// clientIPFromForwarded returns the leftmost address in X-Forwarded-For (original client at the edge).
func clientIPFromForwarded(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	first := strings.TrimSpace(strings.Split(raw, ",")[0])
	if ip := net.ParseIP(first); ip != nil {
		return first
	}
	return ""
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
