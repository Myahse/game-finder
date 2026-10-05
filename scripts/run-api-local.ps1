# Run game-finder API locally (keep this terminal open).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\backend")

$env:DATABASE_URL = "postgres://ftg:ftg@localhost:5433/ftg?sslmode=disable"
if (-not $env:JWT_SECRET) {
  $env:JWT_SECRET = "local-dev-jwt-secret-min-32-chars-long!!"
}
$env:ADDR = ":8080"
$env:CORS_ORIGINS = "http://localhost:9099,http://localhost:9100,http://localhost:9101,http://127.0.0.1:9099,http://127.0.0.1:9100,http://127.0.0.1:9101"
$env:SEED_DEMO = "true"

Write-Host "API -> http://localhost:8080  (health: /healthz)" -ForegroundColor Cyan
go run ./cmd/api
