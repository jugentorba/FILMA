import type { WatchProgress } from '../types';

export const CONTINUE_WATCHING_MIN_SECONDS = 30;
export const PLAYBACK_COMPLETION_RATIO = 0.92;

export function isPlaybackComplete(positionSeconds: number, durationSeconds: number): boolean {
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  const position = Math.max(0, positionSeconds);
  const duration = Math.max(0, durationSeconds);
  return duration > 0 && Math.min(1, position / duration) >= PLAYBACK_COMPLETION_RATIO;
}

export function shouldShowInContinueWatching(progress?: WatchProgress): boolean {
  return Boolean(
    progress
    && !progress.completed
    && Number.isFinite(progress.positionSeconds)
    && progress.positionSeconds >= CONTINUE_WATCHING_MIN_SECONDS,
  );
}
