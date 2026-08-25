package com.jugentorba.filma.youtube

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FilmaYouTubePlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FilmaYouTubePlayer")

    View(FilmaYouTubePlayerView::class) {
      Prop("videoId") { view: FilmaYouTubePlayerView, videoId: String? ->
        view.loadVideo(videoId)
      }
    }
  }
}
