import { Platform, useWindowDimensions } from 'react-native';

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
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isTv = Platform.isTV;
  const isTablet = !isTv && shortSide >= 600;
  const isCompactPhone = !isTv && !isTablet && shortSide < 390;
  const isLargePhone = !isTv && !isTablet && (shortSide >= 430 || longSide >= 900);

  const controlScale = isTv
    ? Math.min(1.08, Math.max(0.92, width / 1920))
    : isTablet
      ? 1.06
      : isCompactPhone
        ? 0.86
        : isLargePhone
          ? 0.96
          : 0.92;

  const horizontalPadding = isTv
    ? Math.round(Math.min(56, Math.max(38, width * 0.028)))
    : isTablet
      ? 24
      : isCompactPhone
        ? 12
        : 14;

  const iconSize = isTv
    ? Math.round(22 * controlScale)
    : isTablet
      ? 21
      : isCompactPhone
        ? 17
        : 19;

  const mediaCardWidth = isTv
    ? Math.round(Math.min(190, Math.max(168, width * 0.095)))
    : isTablet
      ? Math.round(Math.min(176, width * 0.22))
      : isCompactPhone
        ? Math.round(Math.min(124, width * 0.32))
        : Math.round(Math.min(138, width * 0.34));

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
