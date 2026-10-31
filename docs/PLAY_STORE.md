# Publishing Out For Ground on Google Play

The Android app is `mobile/` (Flutter). Its Play Store ID is **`com.outforground.app`**. Once the app is published, this ID can never change.

What is already done in the code:

| Requirement | Where |
|---|---|
| Unique app ID `com.outforground.app` | `mobile/android/app/build.gradle.kts` |
| Release signing with your upload key (`android/key.properties`) | `build.gradle.kts`, `android/key.properties.example` |
| Targets Android 16 (API 36), which meets Play's current target-API rule | Flutter 3.44 default |
| Release builds use the production API over HTTPS only: no cleartext, no LAN scan, no dev "start Docker" screen | `lib/core/env.dart`, `lib/core/api_bootstrap.dart`, `res/xml/network_security_config.xml` |
| No broad photo permission (`READ_MEDIA_IMAGES`); the system photo picker is used | `AndroidManifest.xml` |
| Account deletion in the app (Profile → Delete my account) and on the web (`/delete-account`) | `DELETE /api/me`, `lib/screens/delete_account.dart`, `web/src/components/DeleteAccountCard.tsx` |
| Launcher icon (adaptive + themed), notification icon, dark launch screen | `android/app/src/main/res/` |
| Store icon 512×512 and feature graphic 1024×500 | `brand/play-store/` |
| CI builds the `.aab` | `.github/workflows/android-release.yml` |

## 1. One-time setup

### 1.1 Create the upload key

Run this on your PC. Keep the `.jks` file and both passwords somewhere safe, such as a password manager plus a backup. **Never commit them.** Play App Signing holds the real app-signing key, so a lost upload key can be reset through Play support, but that takes days.

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v `
  -keystore "$env:USERPROFILE\outforground-upload.jks" -storetype JKS `
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Then create `mobile/android/key.properties` (it is git-ignored) from `key.properties.example`:

```properties
storeFile=C:/Users/<you>/outforground-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Print the key's fingerprints. Firebase and Google Sign-In need them in the next steps:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "$env:USERPROFILE\outforground-upload.jks" -alias upload
```

### 1.2 Firebase (push notifications, Google sign-in)

The app ID changed, so Firebase needs a new Android app:

1. Firebase console → Project settings → **Add app → Android**, package `com.outforground.app`.
2. Add the **SHA-1 and SHA-256** fingerprints of:
   - your debug key (`keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android`)
   - your upload key (from 1.1)
   - later, the **Play app-signing key** (Play Console → Test and release → App integrity), once you have uploaded the first bundle. Google sign-in fails on Play-installed copies until this one is added.
3. Download `google-services.json` into `mobile/android/app/`. It is git-ignored; CI reads it from a secret.
4. If you use direct Google OAuth clients (not Firebase), create an **Android** OAuth client for `com.outforground.app` with the same SHA-1s (see `docs/DEPLOY.md`).

### 1.3 Production API

Release builds call `https://game-finder-ddcm.onrender.com` (`productionApiUrl` in `lib/core/env.dart`). An `https://` `API_URL` in `assets/.env`, or `--dart-define=API_URL=...`, overrides it. `http://` values are ignored in release builds.

The Render **free** plan sleeps after 15 minutes. The first launch afterwards waits 30–60 s on "Waking up the server…" (the app waits up to 75 s). Play reviewers and new users will see that, so move the API to a paid Render instance before launch.

Also check the production checklist in `docs/DEPLOY.md`, especially `SEED_DEMO=false`.

## 2. Build the bundle (.aab)

### Option A: GitHub Actions (recommended)

Add these repository secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\outforground-upload.jks")) \| Set-Clipboard` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | key password |
| `GOOGLE_SERVICES_JSON` | the whole content of `google-services.json` |
| `MOBILE_ENV` | the whole content of `mobile/assets/.env` after `sync-env.ps1` with production values (`API_URL=https://...`, Mapbox token, Firebase keys, Google client ID) |

Then go to Actions → **Android release** → Run workflow. When it finishes, download the `outforground-release-<n>` artifact; it contains `app-release.aab` and `mapping.txt`. The run summary shows the signing certificate and the final permission list.

The version code is the workflow's run number, so every bundle is higher than the previous one. The version name comes from `version:` in `mobile/pubspec.yaml`; bump it for each public release (1.0.0 → 1.0.1 …).

The workflow also runs on every push that touches `mobile/`. Without the secrets it makes a debug-signed check build, which Play rejects.

### Option B: locally

```powershell
cd mobile
.\sync-env.ps1          # with production values in the root .env (API_URL=https://...)
flutter build appbundle --release --build-number=2
```

The output is `mobile/build/app/outputs/bundle/release/app-release.aab`. Each upload needs a higher `--build-number` than the last one Play has seen.

## 3. Play Console

1. Create a developer account at <https://play.google.com/console> ($25 one-time, identity verification).
2. **Create app**: name *Out For Ground*. Default language French (fr-FR), since the app is bilingual and launches in Côte d'Ivoire; add English as a translation. Type: App, Free.
3. Work through **Dashboard → Set up your app**:

| Section | Answer |
|---|---|
| Privacy policy | `https://game-finder-swart.vercel.app/privacy` (or your outforground.com domain) |
| App access | "All or some functionality is restricted" → give a **test account** (username + password, already onboarded). Add a note: checking in and joining live games requires being within 500 m of a court in Côte d'Ivoire; the map, game list, profile and challenges work from anywhere. |
| Ads | No ads |
| Content rating | Questionnaire, category "Social / communication" or "Reference / utility". Users interact (friends, challenges with short messages, public profiles); no purchases. |
| Target audience | 13+ (don't include under-13 age groups, which would bring in the Families policy) |
| News app / Government / Financial features / Health | No / No / None / None |
| Data safety | See below |
| Account deletion | Web link: `https://game-finder-swart.vercel.app/delete-account` |

### Data safety answers

Data is encrypted in transit (HTTPS). Users can request deletion (in-app and web).

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Location: precise | Yes (check-ins at a court) | No | App functionality | Optional |
| Location: approximate | Yes (nearby courts/games, "game near you" alerts) | No | App functionality | Optional |
| Personal info: name, email, user IDs (username) | Yes | No | App functionality, account management | Required |
| Photos | Yes (profile photo, court photos) | No | App functionality | Optional |
| App activity: other user-generated content (games, challenges, challenge messages) | Yes | No | App functionality | Optional |
| Device or other IDs (push token) | Yes | No | App functionality (notifications) | Optional |

Third-party SDKs also count. Firebase (Auth, Cloud Messaging) and Mapbox publish their own data-safety disclosures: search for "Firebase data disclosure Google Play" and "Mapbox data safety Google Play" and add what they list. In particular, the Mapbox SDK's telemetry collects approximate location and device data.

### Store listing

- **App name**: Out For Ground
- **Short description** (80 max)
  - FR: Trouvez un match de basket près de chez vous, rejoignez-le, filez au terrain.
  - EN: Find pickup basketball games near you, join in one tap, get to the court.
- **Full description**
  - FR:
    > Ne cherchez plus un terrain. **Trouvez le match.**
    >
    > Out For Ground montre en direct où ça joue autour de vous. Ouvrez l'appli, voyez les matchs en cours et à venir près de vous, rejoignez-en un et laissez-vous guider jusqu'au terrain.
    >
    > • Carte en direct des terrains : match en cours, joueurs présents ou terrain libre
    > • Rejoignez un match en un geste, ou créez le vôtre en choisissant l'heure et le nombre de joueurs
    > • « JE SUIS LÀ » : signalez votre présence sur le terrain pour que les autres sachent qu'il y a du monde
    > • Alertes quand un match démarre près de chez vous, rappels avant vos matchs
    > • Amis, défis, scores, classement des terrains et carte de joueur
    > • Météo du match, itinéraire vers le terrain, partage de vos matchs avec vos amis
    > • Ajoutez les terrains qui manquent à la carte
    >
    > Votre position exacte n'est jamais montrée aux autres : ils voient seulement le nombre de joueurs sur un terrain.
    >
    > Basket pour commencer, d'autres sports bientôt. Grand-Bassam et Abidjan d'abord.
  - EN:
    > Don't search for a court. **Find the game.**
    >
    > Out For Ground shows where people are playing right now. Open the app, see live and upcoming games near you, join one and get directions to the court.
    >
    > • Live court map: game on, players there, or empty
    > • Join a game in one tap, or start your own with a time and player count
    > • "I'M HERE": check in at a court so others know it's busy
    > • Alerts when a game starts near you, reminders before your games
    > • Friends, challenges, scores, court leaderboards and your player card
    > • Game-time weather, directions to the court, share games with friends
    > • Add missing courts to the map
    >
    > Your exact location is never shown to other players; they only see how many people are at a court.
    >
    > Basketball first, more sports soon. Starting in Grand-Bassam and Abidjan.
- **Graphics**: `brand/play-store/icon-512.png`, `brand/play-store/feature-graphic-1024x500.png`, and **at least 2 phone screenshots** (4–8 recommended; take them on a phone or emulator). Good candidates: the live map with markers, a game page with seats, creating a game, the player card, challenges.
- **Category**: Sports. **Contact email**: required; this is shown publicly on the listing. **Website**: your web app URL.

## 4. Testing, then production

- **Internal testing** (Test and release → Testing → Internal): upload the first `.aab` and add yourself. The app is installable within minutes. Check sign-in (email and Google), push notifications, map tiles, check-in and account deletion on a real phone.
- After the first upload, copy the **app-signing key** SHA-1/SHA-256 from App integrity:
  - into Firebase (step 1.2) for Google sign-in,
  - and the SHA-256 into `web/public/.well-known/assetlinks.json` (replace the `TODO` entry; keep both the upload and app-signing fingerprints), then redeploy the web app so shared links open the app.
- **Personal developer accounts** created after November 2023 must run a **closed test with at least 12 testers opted in for 14 days in a row** before they can apply for production. Organisation accounts are exempt. Start the closed test early: a WhatsApp group of players works well.
- Then **Production → Create release**, upload the same or a newer bundle, and send it for review. The first review usually takes a few days.

## 5. Before you submit

- [ ] Put a real contact email in the privacy policy. "Contact" in `web/src/i18n/screens/legal.ts` and `mobile/lib/screens/legal_screens.dart` still says "use the contact email shown on your deployment". Have the terms and privacy policy reviewed; they are marked "not legal advice".
- [ ] The test account for reviewers exists and is onboarded.
- [ ] The API runs on a plan that doesn't sleep (see 1.3).
- [ ] **User-generated content**: profiles, photos and challenge messages are visible to other players. Google Play expects an in-app way to **report and block other users** for apps with user content. Courts can be reported today, but players can't, so add this before or soon after launch.
