# Out For Ground — mobile

Flutter app for Android and iOS. See the [root README](../README.md).

Start the API on your PC first:

```bash
docker compose up -d db api
```

### Mapbox & API from repo `.env`

```powershell
cd mobile
.\sync-env.ps1   # copies MAPBOX_ACCESS_TOKEN / VITE_MAPBOX_ACCESS_TOKEN from ../.env -> assets/.env
flutter pub get
flutter run
```

If `.\sync-env.ps1` closes instantly or prints nothing, use **`sync-env.cmd`** (same folder) or:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\sync-env.ps1
```

You should see `Synced to ...\assets\.env (2 keys)`. Then hot-restart the app (full restart so dotenv reloads).

`main()` loads `assets/.env` at launch (`flutter_dotenv`). `--dart-define` still overrides when set.

On startup the app probes `/healthz`, retries for ~14s, then (on a real device on Wi‑Fi) scans your subnet for the API on port **8080** and remembers the URL. You only need `run-device.ps1` once per network if discovery is slow.

## Physical phone (USB / wireless debugging)

`10.0.2.2` **only works on the Android emulator**. On a real device use your PC’s **Wi‑Fi IP**:

```powershell
cd mobile
.\run-device.ps1
```

Or double-click **`run-device.cmd`** (runs sync-env, sets LAN `API_URL`, then `flutter run`).

Or manually (replace with your PC’s IP from `ipconfig`):

```bash
flutter run --dart-define=API_URL=http://192.168.28.236:8080
```

- Phone and PC must be on the **same Wi‑Fi** (not mobile data only).
- On the phone, open `http://YOUR_PC_IP:8080/api/sports` in Chrome — you should see JSON.
- If that fails, allow **port 8080** through Windows Firewall for Docker/private networks.

## Android emulator

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:8080
```

## Mapbox (optional)

```bash
flutter run --dart-define=API_URL=http://192.168.x.x:8080 --dart-define=MAPBOX_ACCESS_TOKEN=pk....
```

Debug builds allow HTTP to your LAN API. Release builds should use HTTPS.

Push notifications need Firebase (`google-services.json`, `GoogleService-Info.plist`); without them you still get in-app notifications.

On iOS, Google Sign-In also needs its URL scheme: put `GOOGLE_REVERSED_CLIENT_ID = com.googleusercontent.apps.…` (the iOS OAuth client's reversed id) in `ios/Flutter/GoogleSignIn.xcconfig` (git-ignored). Push needs the Push Notifications capability on the App ID (`aps-environment` is in `Runner.entitlements`) and an APNs key in Firebase.
