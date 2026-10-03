# Write Firebase web config from the Firebase console into root .env
# Usage: .\scripts\setup-firebase-auth.ps1

param(
  [string]$ProjectId = '',
  [string]$ApiKey = '',
  [string]$AppId = '',
  [string]$MessagingSenderId = '',
  [string]$AuthDomain = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'
$sync = Join-Path $root 'mobile\sync-env.ps1'

function Set-DotEnvKey([string]$Path, [string]$Key, [string]$Value) {
  $lines = if (Test-Path $Path) { [System.IO.File]::ReadAllLines($Path) } else { @() }
  $out = New-Object System.Collections.Generic.List[string]
  $replaced = $false
  foreach ($line in $lines) {
    if ($line -match "^\s*$Key\s*=") {
      $out.Add("$Key=$Value")
      $replaced = $true
    } else {
      $out.Add($line)
    }
  }
  if (-not $replaced) { $out.Add("$Key=$Value") }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($Path, $out.ToArray(), $utf8)
}

if (-not $ProjectId) { $ProjectId = (Read-Host 'Firebase project ID').Trim() }
if (-not $ApiKey) { $ApiKey = (Read-Host 'Web API key (apiKey)').Trim() }
if (-not $AppId) { $AppId = (Read-Host 'Web app ID (appId)').Trim() }
if (-not $MessagingSenderId) { $MessagingSenderId = (Read-Host 'Messaging sender ID').Trim() }
if (-not $AuthDomain) {
  $AuthDomain = (Read-Host "Auth domain (Enter for $ProjectId.firebaseapp.com)").Trim()
}
if (-not $AuthDomain) { $AuthDomain = "$ProjectId.firebaseapp.com" }

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $root '.env.example') $envFile
}

Set-DotEnvKey $envFile 'FIREBASE_PROJECT_ID' $ProjectId
Set-DotEnvKey $envFile 'VITE_FIREBASE_PROJECT_ID' $ProjectId
Set-DotEnvKey $envFile 'VITE_FIREBASE_API_KEY' $ApiKey
Set-DotEnvKey $envFile 'VITE_FIREBASE_APP_ID' $AppId
Set-DotEnvKey $envFile 'VITE_FIREBASE_MESSAGING_SENDER_ID' $MessagingSenderId
Set-DotEnvKey $envFile 'VITE_FIREBASE_AUTH_DOMAIN' $AuthDomain

& $sync | Out-Host

Write-Host "`nNext:" -ForegroundColor Cyan
Write-Host "1. Firebase Console → Authentication → Google → Enable"
Write-Host "2. Authentication → Settings → Authorized domains → add localhost + Vercel URL"
Write-Host "3. Render → FIREBASE_PROJECT_ID=$ProjectId → redeploy API"
Write-Host "4. Vercel → VITE_FIREBASE_* vars → redeploy web`n"
