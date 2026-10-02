package com.alkoda.casefile;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import java.util.Locale;

/**
 * The whole game lives in one WebView. The bundled files are served from
 * https://appassets.androidplatform.net/assets/www/ so that localStorage
 * (saves, settings, the archive) behaves exactly as it does in a browser.
 *
 * What the wrapper adds (docs/ANDROID.md has the reasoning):
 *  - full screen, edge to edge, with the cutout and gesture insets handed to
 *    the page as CSS variables so nothing sits under a notch;
 *  - Back through the AndroidX dispatcher (predictive back): the game closes
 *    its own windows first, and twice at the top leaves;
 *  - pause, silence and save on every interruption, resume after;
 *  - the screen stays on only while a game is running;
 *  - a small bridge: version, haptics, keep-awake, device language;
 *  - recovery when the WebView renderer is killed, and a plain message when
 *    the device has no WebView at all.
 */
public class MainActivity extends AppCompatActivity {
    private static final String START = "https://appassets.androidplatform.net/assets/www/index.html";
    /** Opens the page on the saved table, paused, instead of the title (js/main.js reads it). */
    private static final String RESUME = "#resume";
    private static final long BACK_AGAIN_MS = 2000;

    private FrameLayout root;
    private WebView web;
    private WebViewAssetLoader loader;
    private long lastBackAt = 0;
    private Toast backToast;
    private Insets lastInsets = Insets.NONE;

    /** Exposed to the page as window.CaseFileAndroid. Only the bundled page can reach it. */
    public class Bridge {
        @JavascriptInterface
        public boolean isApp() { return true; }

        @JavascriptInterface
        public String version() { return BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"; }

        /** The device language, e.g. "ar" or "en-US"; the page follows it on a first run. */
        @JavascriptInterface
        public String locale() { return Locale.getDefault().toLanguageTag(); }

        /** Keep the screen on while a game is running and unpaused; let it sleep otherwise. */
        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        /** A short tick (milliseconds). Silently nothing on devices without a vibrator. */
        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                int d = Math.max(1, Math.min(ms, 80));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(d);
            } catch (Exception ignored) { /* no haptics is fine */ }
        }

        /**
         * A felt cue by name. The touches (tick, confirm, reject) are the system's own feedback, asked of the
         * root view with no flags, so the phone's touch-feedback setting is kept; the WebView's own stays off.
         * The weights (heavy, toll, harm) go to the vibrator as a predefined click or a short waveform.
         */
        @JavascriptInterface
        public void haptic(final String kind) {
            if (kind == null) return;
            runOnUiThread(() -> {
                try {
                    boolean r30 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
                    switch (kind) {
                        case "tick": root.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK); break;
                        case "confirm": root.performHapticFeedback(r30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY); break;
                        case "reject": root.performHapticFeedback(r30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS); break;
                        case "heavy": heavy(); break;
                        case "toll": wave(new long[] {0, 12, 140, 12}); break;
                        case "harm": wave(new long[] {0, 30, 60, 30}); break;
                        default: break;
                    }
                } catch (Exception ignored) { /* no haptics is fine */ }
            });
        }

        private Vibrator vibrator() {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            return v != null && v.hasVibrator() ? v : null;
        }

        private void heavy() {
            Vibrator v = vibrator();
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) v.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK));
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(30);
        }

        private void wave(long[] pattern) {
            Vibrator v = vibrator();
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
            else v.vibrate(pattern, -1);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Draw behind the bars; the page is told where the cutouts are.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0B1516);
        setContentView(root);

        loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        if (!createWebView()) {
            new AlertDialog.Builder(this)
                    .setTitle(R.string.no_webview_title)
                    .setMessage(R.string.no_webview_text)
                    .setCancelable(false)
                    .setPositiveButton(R.string.ok, (d, w) -> finish())
                    .show();
            return;
        }
        // A bundle means the process was killed under the player. The WebView's own
        // state is restored when it can be (restoreState returns null when it cannot,
        // and a bare restore that failed left a blank view); the page is loaded
        // either way, and reopens on the table.
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        web.loadUrl(savedInstanceState == null ? START : START + RESUME);

        // The cutout becomes CSS variables on the page, in CSS pixels. The bars are
        // transient (a swipe shows them for a moment), so their insets are not padded.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            lastInsets = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            pushInsets();
            return WindowInsetsCompat.CONSUMED;
        });

        // Back: the game's own windows and menus close first; at the top,
        // press twice within two seconds to leave.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web == null) { finish(); return; }
                web.evaluateJavascript("(window.CF && CF.UI && CF.UI.back) ? String(CF.UI.back()) : 'false'", value -> {
                    if ("\"true\"".equals(value)) return;
                    long now = System.currentTimeMillis();
                    if (now - lastBackAt < BACK_AGAIN_MS) { finish(); return; }
                    lastBackAt = now;
                    if (backToast != null) backToast.cancel();
                    backToast = Toast.makeText(MainActivity.this, R.string.back_again, Toast.LENGTH_SHORT);
                    backToast.show();
                });
            }
        });
    }

    /** Builds the WebView; false when the device has no WebView implementation. */
    @SuppressLint("SetJavaScriptEnabled")
    private boolean createWebView() {
        try {
            web = new WebView(this);
        } catch (Exception err) {
            web = null;
            return false;
        }
        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setAllowFileAccess(false);
        st.setAllowContentAccess(false);
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setBuiltInZoomControls(false);
        st.setDisplayZoomControls(false);
        st.setSupportZoom(false);
        st.setTextZoom(100);
        st.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setBackgroundColor(0xFF0B1516);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHapticFeedbackEnabled(false); // the game asks for its own ticks
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true); // no text-selection or link menus on a long press
        web.addJavascriptInterface(new Bridge(), "CaseFileAndroid");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Let the system reclaim the renderer while we are hidden; onRenderProcessGone rebuilds it.
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true);
        }
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Stay inside the game; nothing in it links out.
                return !request.getUrl().toString().startsWith("https://appassets.androidplatform.net/");
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                pushInsets();
            }
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The renderer was killed (memory) or crashed: a dead WebView cannot be
                // reused. Rebuild it; the game reopens on the table from its autosave.
                if (view != web) return true;
                root.removeView(web);
                web.destroy();
                web = null;
                if (createWebView()) web.loadUrl(START + RESUME);
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return true;
    }

    private void pushInsets() {
        if (web == null) return;
        float d = getResources().getDisplayMetrics().density;
        String js = "window.CF && CF.UI && CF.UI.setInsets && CF.UI.setInsets("
                + (lastInsets.left / d) + "," + (lastInsets.top / d) + "," + (lastInsets.right / d) + "," + (lastInsets.bottom / d) + ");";
        web.evaluateJavascript(js, null);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        if (web == null) return;
        web.onResume();
        web.resumeTimers();
        web.evaluateJavascript("window.CF && CF.Audio && CF.Audio.resume && CF.Audio.resume(); window.CF && CF.UI && CF.UI.onForeground && CF.UI.onForeground();", null);
    }

    /** Another app, the home screen or a locked screen: the game saves, pauses and goes silent. */
    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.CF && CF.Audio && CF.Audio.suspend && CF.Audio.suspend(); window.CF && CF.UI && CF.UI.onBackground && CF.UI.onBackground();", null);
            web.pauseTimers();
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Immersive: both bars hidden; a swipe from the edge shows them for a moment. */
    private void hideSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
