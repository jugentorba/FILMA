import { Platform, useWindowDimensions } from 'react-native';
import { useFilma } from '../store/FilmaContext';

export type ResponsiveLayout = {
  width: number;
  height: number;
  isTv: boolean;
  isCompactPhone: boolean;
  isLargePhone: boolean;
  isTablet: boolean;
  horizontalPadding: number;
  controlScale: number;
  iconSize: number;
  mediaCardWidth: number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const { state } = useFilma();
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isTv = Platform.isTV;
  const isTablet = !isTv && shortSide >= 600;
  const isCompactPhone = !isTv && !isTablet && shortSide < 390;
  const isLargePhone = !isTv && !isTablet && (shortSide >= 430 || longSide >= 900);
  const densityScale = state.preferences.interfaceDensity === 'comfortable' ? 1.12 : 0.94;

  const automaticScale = isTv
    ? Math.min(1.06, Math.max(0.9, width / 1920))
    : isTablet
      ? 1.04
      : isCompactPhone
        ? 0.84
        : isLargePhone
          ? 0.94
          : 0.9;
  const controlScale = automaticScale * densityScale;

  const horizontalPaddingBase = isTv
    ? Math.round(Math.min(52, Math.max(34, width * 0.026)))
    : isTablet
      ? 22
      : isCompactPhone
        ? 10
        : 12;
  const horizontalPadding = Math.max(8, Math.round(horizontalPaddingBase * (state.preferences.interfaceDensity === 'comfortable' ? 1.08 : 0.94)));

  const iconBase = isTv ? 20 : isTablet ? 20 : isCompactPhone ? 16 : 18;
  const iconSize = Math.max(15, Math.round(iconBase * densityScale));

  const mediaBase = isTv
    ? Math.min(184, Math.max(160, width * 0.09))
    : isTablet
      ? Math.min(168, width * 0.21)
      : isCompactPhone
        ? Math.min(120, width * 0.31)
        : Math.min(134, width * 0.33);
  const mediaCardWidth = Math.round(mediaBase * densityScale);

  return {
    width,
    height,
    isTv,
    isCompactPhone,
    isLargePhone,
    isTablet,
    horizontalPadding,
    controlScale,
    iconSize,
    mediaCardWidth,
  };
}
