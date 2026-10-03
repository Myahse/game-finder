# Copy Firebase native config for FCM push (Android + iOS).
# Easiest: Firebase Console → Project settings → Your apps → download files into repo root:
#   google-services.json
#   GoogleService-Info.plist
# Then run this script. Or place them directly in:
#   mobile/android/app/google-services.json
#   mobile/ios/Runner/GoogleService-Info.plist

$ErrorActionPreference = 'Stop'
$mobile = Split-Path $PSScriptRoot -Parent
$root = Split-Path $mobile -Parent

$androidOut = Join-Path $mobile 'android\app\google-services.json'
$iosOut = Join-Path $mobile 'ios\Runner\GoogleService-Info.plist'

$androidSrc = Join-Path $root 'google-services.json'
$iosSrc = Join-Path $root 'GoogleService-Info.plist'

if (Test-Path $androidSrc) {
  Copy-Item $androidSrc $androidOut -Force
  Write-Host "Copied google-services.json -> android/app/" -ForegroundColor Green
} elseif (-not (Test-Path $androidOut)) {
  Write-Warning "Missing $androidSrc — add an Android app in Firebase and download google-services.json"
}

if (Test-Path $iosSrc) {
  Copy-Item $iosSrc $iosOut -Force
  Write-Host "Copied GoogleService-Info.plist -> ios/Runner/" -ForegroundColor Green
} elseif (-not (Test-Path $iosOut)) {
  Write-Warning "Missing $iosSrc — add an iOS app in Firebase and download GoogleService-Info.plist"
}
