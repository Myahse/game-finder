# Find the Game — mobile

Flutter app for Android and iOS. See the [root README](../README.md).

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:8080
flutter analyze && flutter test
```

Push notifications need Firebase config files (`android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`); without them the app uses in-app notifications only.
