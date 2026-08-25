import type { Favorite, WatchProgress } from '../types';

export const DEFAULT_PROFILE_ID = 'profile-default';
export const DEFAULT_PROFILE_NAME = 'Profile 1';

export function profileMediaKey(profileId: string, mediaId: string): string {
  return `${profileId}:${mediaId}`;
}

export function progressForProfile(
  progress: Record<string, WatchProgress>,
  profileId: string,
): Record<string, WatchProgress> {
  const scoped: Record<string, WatchProgress> = {};
  for (const item of Object.values(progress)) {
    if ((item.profileId ?? DEFAULT_PROFILE_ID) === profileId) scoped[item.mediaId] = item;
  }
  return scoped;
}

export function favoritesForProfile(
  favorites: Record<string, Favorite>,
  profileId: string,
): Record<string, Favorite> {
  const scoped: Record<string, Favorite> = {};
  for (const item of Object.values(favorites)) {
    if ((item.profileId ?? DEFAULT_PROFILE_ID) === profileId) scoped[item.mediaId] = item;
  }
  return scoped;
}
