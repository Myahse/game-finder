# Allow Docker API (port 8080) from private networks — run once as Administrator.
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$name = 'Find the Game API (8080)'
$existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule already exists: $name"
  exit 0
}

New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Private, Domain
Write-Host "Added firewall rule for TCP 8080 (Private, Domain profiles)."
