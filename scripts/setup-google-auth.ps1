# Configure Google Sign-In across root .env, iOS Info.plist, and mobile assets.
# Usage:
#   .\scripts\setup-google-auth.ps1 -WebClientId '<web>.apps.googleusercontent.com'
#   .\scripts\setup-google-auth.ps1 -WebClientId '...' -IosClientId '<ios>.apps.googleusercontent.com'
# Or run without -WebClientId to be prompted (values hidden when typed).

param(
  [string]$WebClientId = '',
  [string]$IosClientId = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'
$plist = Join-Path $root 'mobile\ios\Runner\Info.plist'
$sync = Join-Path $root 'mobile\sync-env.ps1'

function Test-GoogleClientId([string]$Id, [string]$Label) {
  if (-not $Id) { return }
  if ($Id -notmatch '^[\w-]+\.apps\.googleusercontent\.com$') {
    throw "$Label must look like 123456789-abc.apps.googleusercontent.com"
  }
}

function Get-ReversedIosScheme([string]$IosClientId) {
  if ($IosClientId -match '^([\w-]+)\.apps\.googleusercontent\.com$') {
    return "com.googleusercontent.apps.$($Matches[1])"
  }
  throw 'Invalid iOS client ID'
}

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
  if (-not $replaced) {
    if ($out.Count -gt 0 -and $out[$out.Count - 1] -ne '') { $out.Add('') }
    $out.Add("$Key=$Value")
  }
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($Path, $out.ToArray(), $utf8)
}

if (-not $WebClientId) {
  $WebClientId = (Read-Host 'Google Web client ID (Web application OAuth client)').Trim()
}
if (-not $IosClientId) {
  $IosClientId = (Read-Host 'Google iOS client ID (optional; Enter to skip)').Trim()
}

Test-GoogleClientId $WebClientId 'Web client ID'
Test-GoogleClientId $IosClientId 'iOS client ID'

$googleClientIds = if ($IosClientId) { "$WebClientId,$IosClientId" } else { $WebClientId }

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $root '.env.example') $envFile
  Write-Warning "Created $envFile from .env.example — fill DATABASE_URL and other secrets if needed."
}

Set-DotEnvKey $envFile 'VITE_GOOGLE_CLIENT_ID' $WebClientId
Set-DotEnvKey $envFile 'GOOGLE_CLIENT_IDS' $googleClientIds
if ($IosClientId) {
  Set-DotEnvKey $envFile 'GOOGLE_IOS_CLIENT_ID' $IosClientId
}

if ($IosClientId -and (Test-Path $plist)) {
  $scheme = Get-ReversedIosScheme $IosClientId
  $xml = [xml](Get-Content $plist -Raw)
  $dict = $xml.plist.dict
  if (-not $dict) { throw "Unexpected Info.plist structure" }

  # Remove existing CFBundleURLTypes (re-run safe).
  $children = @($dict.ChildNodes)
  for ($i = 0; $i -lt $children.Count; $i++) {
    if ($children[$i].Name -eq 'key' -and $children[$i].InnerText -eq 'CFBundleURLTypes') {
      $dict.RemoveChild($children[$i]) | Out-Null
      if ($i -lt $children.Count -and $children[$i + 1].Name -eq 'array') {
        $dict.RemoveChild($children[$i + 1]) | Out-Null
      }
      break
    }
  }

  $urlTypesKey = $xml.CreateElement('key')
  $urlTypesKey.InnerText = 'CFBundleURLTypes'
  $urlTypesArr = $xml.CreateElement('array')
  $entry = $xml.CreateElement('dict')

  $roleKey = $xml.CreateElement('key'); $roleKey.InnerText = 'CFBundleTypeRole'
  $roleVal = $xml.CreateElement('string'); $roleVal.InnerText = 'Editor'
  $schemesKey = $xml.CreateElement('key'); $schemesKey.InnerText = 'CFBundleURLSchemes'
  $schemesArr = $xml.CreateElement('array')
  $schemeVal = $xml.CreateElement('string'); $schemeVal.InnerText = $scheme
  $schemesArr.AppendChild($schemeVal) | Out-Null

  $entry.AppendChild($roleKey) | Out-Null
  $entry.AppendChild($roleVal) | Out-Null
  $entry.AppendChild($schemesKey) | Out-Null
  $entry.AppendChild($schemesArr) | Out-Null
  $urlTypesArr.AppendChild($entry) | Out-Null

  $dict.AppendChild($urlTypesKey) | Out-Null
  $dict.AppendChild($urlTypesArr) | Out-Null

  $xml.Save($plist)
  Write-Host "Updated iOS URL scheme: $scheme" -ForegroundColor Green
}

& $sync | Out-Host

Write-Host "`n=== Next: deploy env ===`n" -ForegroundColor Cyan
Write-Host "1. Render → Environment → GOOGLE_CLIENT_IDS=$googleClientIds"
Write-Host "2. Vercel  → VITE_GOOGLE_CLIENT_ID=$WebClientId  (redeploy web)"
Write-Host "3. Google Cloud → Web client → Authorized JavaScript origins:"
Write-Host "     http://localhost:5173, http://localhost:9099, https://game-finder-swart.vercel.app"
if ($IosClientId) {
  Write-Host "4. Google Cloud → iOS client → Bundle ID: com.findthegame.findTheGame"
}
Write-Host "5. Google Cloud → Android → package com.findthegame.find_the_game + debug SHA-1"
Write-Host "`nRun: .\scripts\render-env.ps1 -VercelOrigin https://game-finder-swart.vercel.app`n"
