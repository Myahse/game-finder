# Push API secrets from repo-root .env to Fly (never commit .env).
# Usage: .\scripts\fly-secrets.ps1 [-App game-finder-api] [-VercelOrigin https://your-app.vercel.app]
param(
  [string]$App = 'game-finder-api',
  [string]$VercelOrigin = ''
)

$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
  exit 1
}

function Get-DotEnvValue([string]$Key) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#') { continue }
    if ($line -match "^\s*$Key\s*=\s*(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return ''
}

function Set-FlySecret([string]$Name, [string]$Value) {
  if (-not $Value) {
    Write-Warning "Skipping empty $Name (save .env on disk if you edited in the IDE)"
    return
  }
  $tmp = Join-Path $env:TEMP "fly-secret-$Name.env"
  [System.IO.File]::WriteAllText($tmp, "$Name=$Value`n", [System.Text.UTF8Encoding]::new($false))
  Get-Content $tmp -Raw | fly secrets import --app $App
  Remove-Item -Force $tmp
}

$publicBase = "https://$App.fly.dev"
$cors = Get-DotEnvValue 'CORS_ORIGINS'
if ($VercelOrigin) {
  $cors = ($cors.Split(',') + $VercelOrigin.Trim()) | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique
  $cors = ($cors -join ',')
}

Write-Host "Setting Fly secrets on app: $App (PUBLIC_BASE_URL=$publicBase)"

Set-FlySecret 'PUBLIC_BASE_URL' $publicBase
Set-FlySecret 'SEED_DEMO' 'false'
Set-FlySecret 'CORS_ORIGINS' $cors

foreach ($k in @(
    'DATABASE_URL', 'JWT_SECRET', 'ADMIN_EMAILS',
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL',
    'FCM_PROJECT_ID', 'FCM_SERVICE_ACCOUNT_JSON', 'MAPBOX_ACCESS_TOKEN'
  )) {
  Set-FlySecret $k (Get-DotEnvValue $k)
}

if (-not (Get-DotEnvValue 'DATABASE_URL')) {
  Write-Error 'DATABASE_URL is empty in .env on disk. Save the file in your editor, then run this script again.'
  exit 1
}

Write-Host 'Done. Check: fly status -a' $App
