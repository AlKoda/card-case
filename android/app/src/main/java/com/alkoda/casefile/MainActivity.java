package com.alkoda.casefile;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

/**
 * The whole game lives in a WebView. The bundled files are served from
 * https://appassets.androidplatform.net/assets/www/ so that localStorage
 * (saves, settings, the archive) behaves exactly as it does in a browser.
 */
public class MainActivity extends AppCompatActivity {
    private static final String START = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView web;

    /** Exposed to the page as window.CaseFileAndroid. */
    public static class Bridge {
        @JavascriptInterface
        public boolean isApp() { return true; }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setAllowFileAccess(false);
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setBuiltInZoomControls(false);
        st.setDisplayZoomControls(false);
        st.setSupportZoom(false);
        st.setTextZoom(100);
        web.setBackgroundColor(0xFF0B1516);
        web.addJavascriptInterface(new Bridge(), "CaseFileAndroid");

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
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
        });

        setContentView(web);
        if (savedInstanceState == null) web.loadUrl(START);
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }

    /** Back closes the game's own windows and menus first; on the title screen it leaves. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.CF && CF.UI && CF.UI.back) ? String(CF.UI.back()) : 'false'", value -> {
            if (!"\"true\"".equals(value)) runOnUiThread(() -> finish());
        });
    }
}
