# The Android app: what an APK should have, should not have, and what players expect

Notes gathered from Google's core app quality guidelines, the Play games
"Level Up" guidelines, the WebView and edge-to-edge documentation, and the
2026 sideloading rules, then checked against this wrapper. Each item says
what the app does about it. `android/` holds the wrapper; the game itself
is the same code as the web page.

## What an APK should have

| Item | Why | Here |
| --- | --- | --- |
| A stable signing key across builds | Android refuses to install an APK signed with a different key over an installed one. A key made fresh on every CI run means "App not installed" on every update. | CI signs every build with one key: a secret keystore when `ANDROID_KEYSTORE_B64` is set, else the public sideload key in `android/keystore/` (see "Signing"). |
| A rising `versionCode` | A lower `versionCode` never installs over a higher one. | `versionCode` is the CI run number; `versionName` is `0.1.<run>`. |
| Current `targetSdk` / `compileSdk` | Google's quality bar and the 2026 install rules expect the latest SDK; older targets get compatibility shims and warnings. | 35 (Android 15). |
| A release build, not a debug build | Debug builds carry debuggable flags and debug signing; the quality checklist forbids debug artifacts in production. | The APK is `assembleRelease`, signed. |
| Back that means something | Back must close what is open, and leave only from the top; Android 13+ predictive back needs the `OnBackPressedCallback` API, not `onBackPressed()`. | `OnBackPressedCallback` asks the game first; at the top, "press again to leave". `enableOnBackInvokedCallback` is on. |
| Pause on lock, sleep, switch; resume after | Sleep_Resume, Lock_Resume, App_Switcher in the core checklist. | `onPause` silences audio, saves, pauses the WebView; `onResume` brings it back. |
| Sound stops in the background | A game playing music from behind the home screen is the top complaint of every wrapper. | Audio is suspended in `onPause` and by the page's own visibility events. |
| State kept across process death | Android kills background apps; the player must not lose the game. | The game autosaves on every change and on pause; the WebView state is saved too. |
| Backup and device-to-device transfer rules | Auto Backup should carry saves and settings to a new phone; the rules must say so explicitly on Android 12+. | `dataExtractionRules` and `fullBackupContent` include the WebView storage and exclude caches. |
| Edge-to-edge with insets respected | Android 15 draws behind system bars and into cutouts; a game must keep controls out of the notch and gesture areas. | The wrapper reads the cutout and system-bar insets and hands them to the page as CSS variables; the page pads its top bar and windows with them. |
| Full screen for a game | Immersive mode is the accepted exception to "keep the bars visible" for games, with a swipe to bring the bars back. | `WindowInsetsControllerCompat`, `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`. |
| A screen that stays on while playing | Nobody wants the screen to sleep during a 60-second verb, but a wake lock forever drains the battery. | The screen stays on only while a game is running and not paused; the page tells the wrapper. |
| Recovery when the renderer dies | The WebView renderer can be killed for memory; the app must not show a blank screen. | `onRenderProcessGone` rebuilds the WebView and reloads the game, which resumes from its save. |
| A message when WebView is missing | Some devices have WebView disabled; the app should say so instead of crashing. | A dialog explains, then exits. |
| Right-to-left support | The game has Arabic. | `supportsRtl` on; the page itself flips. |
| Per-app language | Android 13 lets the user pick a language per app in system settings. | `localeConfig` lists English and Arabic; a first run follows the device language. |
| Explicit `exported` on components | Required since Android 12. | Set. |
| A game category | Lets the system treat it as a game (game mode, battery). | `appCategory="game"`. |
| Minimal permissions | The checklist: only what the app needs, asked when needed. | Only `VIBRATE` (no runtime prompt); no network, no storage. |
| No metrics leaking from the WebView | Privacy item. | `android.webkit.WebView.MetricsOptOut`. |
| Touch targets 48dp, contrast, no tiny text | Accessibility items in the checklist. | The game's buttons and cards are large; the UI scale setting goes to 150%. |
| Landscape and the fold states | A game may lock orientation, but must handle both landscapes and folding without losing state. | `sensorLandscape`, `configChanges` handled by the page, which is fluid. |

## What an APK should not do

- Ship an unsigned or debug-signed build to players (see above).
- Reuse `versionCode 1` forever.
- Keep playing music after the home button.
- Hold a wake lock while paused or on the title.
- Use `setAllowUniversalAccessFromFileURLs` or `file://` for the page; use `WebViewAssetLoader` (this app does).
- Expose `addJavascriptInterface` to untrusted content: the bridge here only serves the bundled page, and the WebView refuses to navigate anywhere else.
- Ask for permissions it does not use.
- Lose the game when the renderer or the process is killed.
- Rely on `onBackPressed()` (deprecated in 13) or `SYSTEM_UI_FLAG_*` (deprecated in 11).
- Let content sit under the notch or the gesture bar.
- Draw the page at the wrong scale: text zoom is pinned to 100% and pinch zoom is the game's own.

## Quality of life players expect from a mobile game

| Expectation | Here |
| --- | --- |
| It opens where I left off | The game autosaves; the app restores it on launch and after any interruption. |
| Back works like every other app | Back closes windows, menus and dialogs in order; twice at the top leaves. |
| Silence when I switch away, sound when I return | Yes. |
| It pauses when I look away | "Pause when you switch away" setting, on by default. |
| The screen does not sleep on me mid-turn | Only while playing. |
| A little haptic feedback on touches | A "Vibration" setting: a light tick when a card is picked up, dropped, turned over, or a choice is made. Off on devices without a vibrator. |
| No accidental zoom, no text selection, no long-press menus | `touch-action`, `user-select`, and the WebView's own zoom off. |
| It speaks my language | First run follows the device language (English or Arabic); the picker changes it any time. |
| I can see which version I have | The Settings screen shows the app version. |
| It respects my notch and gesture bar | Insets are applied. |
| Installing an update keeps my save | Same key, rising version code, same storage. |
| It works offline | Everything is bundled; there is no network. |
| Installing does not need a store account | Sideload; ADB is exempt from the 2026 developer verification, and the free limited-distribution account covers up to 20 devices. |

## Signing

Every APK is signed with the same key so that a new build installs over the
old one. Two sources, in order:

1. Repository secrets `ANDROID_KEYSTORE_B64` (a base64 PKCS12 keystore),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   Use this for anything that goes to a store.
2. Otherwise `android/keystore/sideload.jks.b64`, a key committed in the
   open. It is not a secret and gives no protection beyond "updates install";
   anyone can sign an APK with it. It exists so that the `apk-latest` build
   updates in place on a tablet.

A switch from the public key to a private one is a one-time uninstall on
each device.

## Sources

- Core app quality guidelines: https://developer.android.com/docs/quality-guidelines/core-app-quality
- Play games Level Up guidelines: https://developer.android.com/games/guidelines
- Edge-to-edge in views: https://developer.android.com/develop/ui/views/layout/edge-to-edge
- Display cutouts: https://developer.android.com/develop/ui/views/layout/display-cutout
- Predictive back: https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture
- Managing WebView objects: https://developer.android.com/develop/ui/views/layout/webapps/managing-webview
- Backup best practices: https://developer.android.com/privacy-and-security/risks/backup-best-practices
- Keep the screen on: https://developer.android.com/develop/background-work/background-tasks/awake/screen-on
- Developer verification and sideloading timeline: https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html
