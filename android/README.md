# Case File for Android

A thin wrapper: one full-screen `WebView` that serves the game from the
APK's assets (`app/src/main/assets/www/`, copied in at build time by
`.github/workflows/android.yml` and never committed). Saves, settings and
the archive live in the WebView's local storage, exactly as in a browser.

- **Back** closes the top window or menu; on the title screen it leaves.
- The screen stays on and the system bars hide while playing.
- Landscape only.

The workflow uploads `app-debug.apk` as a build artifact and attaches it to
the `apk-latest` release. Sideload it on the tablet (allow installs from
unknown sources for your browser or file manager). To build locally with the
Android SDK installed: copy `index.html css js manifest.webmanifest sw.js
icons` into `app/src/main/assets/www/`, then `gradle assembleDebug` here.
