# Case File for Android

A thin wrapper: one full-screen `WebView` that serves the game from the
APK's assets (`app/src/main/assets/www/`, copied in at build time by
`.github/workflows/android.yml` and never committed). Saves, settings and
the archive live in the WebView's local storage, exactly as in a browser.
`docs/ANDROID.md` lists what the wrapper does and why.

- **Back** closes the top window or menu; twice at the top leaves.
- Full screen, edge to edge; the notch and gesture bar are kept clear.
- The screen stays on while a game runs; it may sleep in menus or paused.
- Sound stops and the game saves whenever the app goes to the background.
- Landscape only. English and Arabic (also in the per-app language setting).

The workflow builds a signed release, uploads `CaseFile.apk` as an artifact
and attaches it to the `apk-latest` release. Every build has a higher
`versionCode` and the same signing key, so it installs over the last one.
Sideload it on the tablet (allow installs from unknown sources for your
browser or file manager; `adb install -r CaseFile.apk` also works).

Signing uses the repository secrets `ANDROID_KEYSTORE_B64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
when they exist, else the public key in `keystore/sideload.jks.b64` (not a
secret; it only makes updates install in place).

To build locally with the Android SDK installed: copy `index.html css js
manifest.webmanifest sw.js icons` into `app/src/main/assets/www/`, then
`gradle assembleRelease` here.
