# Copy API + Mapbox vars from repo root .env -> mobile/assets/.env for flutter_dotenv.
$ErrorActionPreference = 'Stop'

$rootEnv = Join-Path $PSScriptRoot '..\.env'
$out = Join-Path $PSScriptRoot 'assets\.env'
$assets = Join-Path $PSScriptRoot 'assets'
if (-not (Test-Path $assets)) {
  New-Item -ItemType Directory -Path $assets | Out-Null
}

$wanted = @(
  'API_URL', 'VITE_API_URL', 'PUBLIC_BASE_URL', 'WEB_APP_URL', 'MAPBOX_ACCESS_TOKEN', 'VITE_MAPBOX_ACCESS_TOKEN', 'R2_PUBLIC_URL',
  'VITE_GOOGLE_CLIENT_ID', 'GOOGLE_SERVER_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID',
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_DOMAIN',
  'FIREBASE_API_KEY', 'FIREBASE_APP_ID', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_PROJECT_ID', 'FIREBASE_AUTH_DOMAIN', 'FCM_PROJECT_ID'
)
$found = @{}

if (Test-Path $rootEnv) {
  foreach ($line in Get-Content $rootEnv -Encoding UTF8) {
    $t = $line.Trim()
    if ($t.Length -eq 0 -or $t.StartsWith('#')) { continue }
    if ($t -notmatch '=') { continue }
    $parts = $t -split '=', 2
    $key = $parts[0].Trim()
    if ($wanted -contains $key) {
      $found[$key] = $parts[1].Trim()
    }
  }
} else {
  Write-Warning "Root .env not found: $rootEnv"
}

$mapbox = $found['MAPBOX_ACCESS_TOKEN']
if (-not $mapbox) { $mapbox = $found['VITE_MAPBOX_ACCESS_TOKEN'] }
if ($mapbox -and -not $found['MAPBOX_ACCESS_TOKEN']) { $found['MAPBOX_ACCESS_TOKEN'] = $mapbox }
if ($mapbox -and -not $found['VITE_MAPBOX_ACCESS_TOKEN']) { $found['VITE_MAPBOX_ACCESS_TOKEN'] = $mapbox }

$googleWeb = $found['VITE_GOOGLE_CLIENT_ID']
if ($googleWeb -and -not $found['GOOGLE_SERVER_CLIENT_ID']) { $found['GOOGLE_SERVER_CLIENT_ID'] = $googleWeb }

if (( -not $found['API_URL']) -and (Test-Path $out)) {
  foreach ($line in [System.IO.File]::ReadAllLines($out)) {
    if ($line -match '^\s*API_URL\s*=\s*(.+)\s*$') {
      $found['API_URL'] = $matches[1].Trim()
      break
    }
  }
}

if (-not $found['API_URL']) {
  if ($found['VITE_API_URL']) {
    $found['API_URL'] = $found['VITE_API_URL']
  } elseif ($found['PUBLIC_BASE_URL']) {
    $found['API_URL'] = $found['PUBLIC_BASE_URL']
  }
}
if (-not $found['API_URL']) {
  $lan = & (Join-Path $PSScriptRoot 'scripts\lan-ipv4.ps1')
  if ($lan) {
    $found['API_URL'] = "http://${lan}:8080"
    Write-Host "Detected LAN API_URL=$($found['API_URL'])"
  }
}

if (-not $found['PUBLIC_BASE_URL'] -and $found['API_URL']) {
  $found['PUBLIC_BASE_URL'] = $found['API_URL']
}

$lines = New-Object System.Collections.Generic.List[string]
foreach ($key in $wanted) {
  if ($found.ContainsKey($key) -and $found[$key]) {
    $lines.Add("$key=$($found[$key])")
  }
}
if ($found['R2_PUBLIC_URL']) {
  $lines.Add("MEDIA_PUBLIC_ORIGIN=$($found['R2_PUBLIC_URL'])")
}

if ($lines.Count -eq 0) {
  $example = Join-Path $assets '.env.example'
  if (Test-Path $example) {
    Copy-Item $example $out -Force
    Write-Warning "No API_URL / MAPBOX values in $rootEnv - copied .env.example to assets/.env"
  } else {
    Write-Error "Nothing to sync. Add MAPBOX_ACCESS_TOKEN or VITE_MAPBOX_ACCESS_TOKEN to $rootEnv"
    exit 1
  }
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($out, $lines.ToArray(), $utf8NoBom)
  Write-Host "Synced to $out ($($lines.Count) keys)"
  foreach ($line in $lines) {
    if ($line -match '^([^=]+)=(.+)$') {
      $k = $matches[1]
      $v = $matches[2]
      $hint = if ($v.Length -gt 12) { $v.Substring(0, 8) + '...' } else { if ($v) { '(set)' } else { '(empty)' } }
      Write-Host "  $k $hint"
    }
  }
}

exit 0
