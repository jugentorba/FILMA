package com.jugentorba.filma.youtube

import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class FilmaYouTubePlayerView(
  context: Context,
  appContext: AppContext,
) : ExpoView(context, appContext) {
  private var currentVideoId: String? = null
  private val appReferrer = "https://${context.packageName.lowercase()}"

  private val player = WebView(context).also { webView ->
    webView.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    webView.setBackgroundColor(Color.BLACK)
    webView.isFocusable = true
    webView.isFocusableInTouchMode = true
    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.mediaPlaybackRequiresUserGesture = false
    webView.webViewClient = object : WebViewClient() {}
    webView.webChromeClient = WebChromeClient()
    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
    addView(webView)
  }

  fun loadVideo(videoId: String?) {
    val safeId = videoId?.trim()?.takeIf { it.matches(Regex("^[A-Za-z0-9_-]{6,20}$")) }
    if (safeId == currentVideoId) return
    currentVideoId = safeId

    if (safeId == null) {
      player.loadUrl("about:blank")
      return
    }

    val origin = Uri.encode(appReferrer)
    val destination = buildString {
      append("https://www.youtube.com/embed/")
      append(Uri.encode(safeId))
      append("?autoplay=1&playsinline=1&enablejsapi=1&origin=")
      append(origin)
    }

    player.loadUrl(destination, mapOf("Referer" to appReferrer))
    player.post { player.requestFocus() }
  }

  override fun onDetachedFromWindow() {
    player.stopLoading()
    player.loadUrl("about:blank")
    currentVideoId = null
    super.onDetachedFromWindow()
  }
}
