# Sign in with Apple (Firebase)

**You need a paid [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year)** to turn this on for real users. Without it, keep using **email/password** and **Google** on iPhone — the Apple button stays hidden.

The app uses **Firebase Auth** for Apple (same `/api/auth/firebase` endpoint as Google).

## When you're ready

**Web (Vercel):** set `VITE_ENABLE_APPLE_SIGN_IN=true` after the steps below.

**iOS app:** build with `flutter build ios --dart-define=ENABLE_APPLE_SIGN_IN=true`.

## Firebase console

1. **Authentication → Sign-in method → Apple** → Enable.
2. Register your **Apple Services ID** (web) and iOS app **Bundle ID** `com.findthegame.findTheGame` in the Apple Developer portal.
3. In Apple Developer: **Identifiers → App ID** → enable **Sign In with Apple** for the app.
4. For web: add your domain (e.g. `game-finder-swart.vercel.app`) and return URL from Firebase to **Services ID** configuration.

## iOS app

`mobile/ios/Runner/Runner.entitlements` includes Sign in with Apple. In Xcode, enable the capability on the Runner target if the archive fails.

## No extra env vars

Uses the same `VITE_FIREBASE_*` / mobile Firebase config as Google.
