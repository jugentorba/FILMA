const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ACTIVITY_NAME = '.YouTubeTvActivity';
const PACKAGE_PATH = ['com', 'jugentorba', 'filma'];

const JAVA_SOURCE = `package com.jugentorba.filma;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class YouTubeTvActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();

        final Uri uri = getIntent() != null ? getIntent().getData() : null;
        final String videoId = uri != null ? uri.getLastPathSegment() : null;
        if (videoId == null || !videoId.matches("[A-Za-z0-9_-]{6,20}")) {
            finish();
            return;
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isAllowedPlayerUrl(url);
            }
        });

        setContentView(webView);
        final String embedUrl = "https://www.youtube.com/embed/" + Uri.encode(videoId)
            + "?autoplay=1&controls=1&playsinline=1&fs=1&rel=0";
        webView.loadUrl(embedUrl);
        webView.requestFocus();
    }

    private boolean isAllowedPlayerUrl(String url) {
        if (url == null) return false;
        Uri parsed = Uri.parse(url);
        String host = parsed.getHost();
        String path = parsed.getPath();
        if (host == null || path == null) return false;
        boolean allowedHost = host.equals("www.youtube.com") || host.equals("youtube.com")
            || host.equals("www.youtube-nocookie.com") || host.equals("youtube-nocookie.com");
        return allowedHost && path.startsWith("/embed/");
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public void onBackPressed() {
        finish();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
`;

function withYouTubeActivityManifest(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return config;

    application.activity = application.activity ?? [];
    const exists = application.activity.some(activity => activity.$?.['android:name'] === ACTIVITY_NAME);
    if (!exists) {
      application.activity.push({
        $: {
          'android:name': ACTIVITY_NAME,
          'android:exported': 'true',
          'android:hardwareAccelerated': 'true',
          'android:screenOrientation': 'landscape',
          'android:theme': '@android:style/Theme.Black.NoTitleBar.Fullscreen',
          'android:configChanges': 'keyboard|keyboardHidden|orientation|screenSize|uiMode',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: [{ $: { 'android:scheme': 'filmayoutube', 'android:host': 'watch' } }],
        }],
      });
    }
    return config;
  });
}

function withYouTubeActivitySource(config) {
  return withDangerousMod(config, ['android', async config => {
    const javaDir = path.join(
      config.modRequest.platformProjectRoot,
      'app', 'src', 'main', 'java',
      ...PACKAGE_PATH,
    );
    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(path.join(javaDir, 'YouTubeTvActivity.java'), JAVA_SOURCE, 'utf8');
    return config;
  }]);
}

module.exports = function withYouTubeTvPlayer(config) {
  config = withYouTubeActivityManifest(config);
  config = withYouTubeActivitySource(config);
  return config;
};
