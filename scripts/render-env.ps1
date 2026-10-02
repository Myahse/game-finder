# Print Render environment variables from repo-root .env (paste into Render dashboard).
# Usage: .\scripts\render-env.ps1 [-VercelOrigin https://game-finder-swart.vercel.app] [-ApiHost https://game-finder-api.onrender.com]

param(
  [string]$VercelOrigin = '',
  [string]$ApiHost = 'https://game-finder-api.onrender.com'
)

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile — copy from .env.example and fill in values."
  exit 1
}

function Get-DotEnvValue([string]$Key) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*#") { continue }
    if ($line -match "^\s*$Key\s*=\s*(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return ''
}

$publicBase = $ApiHost.TrimEnd('/')
$cors = Get-DotEnvValue 'CORS_ORIGINS'
if ($VercelOrigin) {
  $origin = $VercelOrigin.TrimEnd('/')
  if ($cors -notmatch [regex]::Escape($origin)) {
    $cors = if ($cors) { "$cors,$origin" } else { $origin }
  }
}

Write-Host "`n=== Paste into Render → game-finder-api → Environment ===`n" -ForegroundColor Cyan
@(
  @{ Key = 'DATABASE_URL'; Value = Get-DotEnvValue 'DATABASE_URL' }
  @{ Key = 'JWT_SECRET'; Value = Get-DotEnvValue 'JWT_SECRET' }
  @{ Key = 'PUBLIC_BASE_URL'; Value = $publicBase }
  @{ Key = 'CORS_ORIGINS'; Value = $cors }
  @{ Key = 'ADMIN_EMAILS'; Value = Get-DotEnvValue 'ADMIN_EMAILS' }
  @{ Key = 'SEED_DEMO'; Value = 'false' }
  @{ Key = 'R2_ACCOUNT_ID'; Value = Get-DotEnvValue 'R2_ACCOUNT_ID' }
  @{ Key = 'R2_ACCESS_KEY_ID'; Value = Get-DotEnvValue 'R2_ACCESS_KEY_ID' }
  @{ Key = 'R2_SECRET_ACCESS_KEY'; Value = Get-DotEnvValue 'R2_SECRET_ACCESS_KEY' }
  @{ Key = 'R2_BUCKET_NAME'; Value = Get-DotEnvValue 'R2_BUCKET_NAME' }
  @{ Key = 'R2_PUBLIC_URL'; Value = Get-DotEnvValue 'R2_PUBLIC_URL' }
) | ForEach-Object {
  if ($_.Value) {
    Write-Host "$($_.Key)=$($_.Value)"
  } else {
    Write-Host "# $($_.Key)= (missing in .env)" -ForegroundColor DarkYellow
  }
}

Write-Host "`n=== Then update Vercel + local .env ===`n" -ForegroundColor Cyan
Write-Host "VITE_API_URL=$publicBase"
Write-Host "API_URL=$publicBase"
Write-Host "PUBLIC_BASE_URL=$publicBase"
Write-Host "`nRedeploy Vercel after changing VITE_API_URL. Run mobile\sync-env.ps1 for the app.`n"
