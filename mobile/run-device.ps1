# Run on a physical phone on the same Wi-Fi as this PC (Docker API on :8080).
$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'sync-env.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$ip = & (Join-Path $PSScriptRoot 'scripts\lan-ipv4.ps1')
if (-not $ip) {
  Write-Error 'Could not detect a LAN IPv4 address. Set API_URL in assets/.env manually.'
  exit 1
}

$api = "http://${ip}:8080"
$envFile = Join-Path $PSScriptRoot 'assets\.env'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$rest = @()
if (Test-Path $envFile) {
  foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
    if ($line -match '^\s*API_URL\s*=') { continue }
    $rest += $line
  }
}
$rest += "API_URL=$api"
[System.IO.File]::WriteAllLines($envFile, $rest, $utf8NoBom)

Write-Host "Using API_URL=$api (Wi-Fi/LAN IP, not Docker bridge)"
Write-Host "Mapbox from assets/.env (synced from repo .env)"
Write-Host "Test from phone Chrome: $api/api/sports"
Write-Host ""
Write-Host "If the phone cannot connect, allow inbound TCP 8080 (run as Admin once):"
Write-Host "  New-NetFirewallRule -DisplayName 'Find the Game API' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080"
Write-Host ""
Write-Host "Starting flutter run..."

Set-Location $PSScriptRoot
flutter run --dart-define=API_URL=$api
