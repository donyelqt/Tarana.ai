/**
 * Inline SVG icons shared by the mobile auth screens.
 *
 * The web app pulls these from `lucide-react` (`src/app/auth/signin:14`,
 * `src/app/auth/signup:13`), which is Metro-blocked. These are the exact
 * stroke shapes lucide ships, kept as react-native-svg so the mobile screens
 * render identically to the web mobile view. Raw `<svg>` does not exist in
 * React Native — it red-screens at runtime — so every icon is an `Svg`
 * component with identical path data / strokes / colors.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Polyline, Circle, Line } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function HomeIcon({ size = 16, color = '#ffffff', strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

/** Eye icon — web signin/signup show/hide password toggle. */
export function EyeIcon({ size = 20, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <Path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368" />
    </Svg>
  );
}

/** Eye-slash icon — hide password. */
export function EyeSlashIcon({ size = 20, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368m1.671-2.195C7.523 5 12 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.832-.67 1.613-1.176 2.318M15.362 17.362A9.953 9.953 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.045-3.368M3 3l18 18" />
    </Svg>
  );
}

/** Checkmark — web signup "Strong password" success indicator. */
export function CheckIcon({ size = 14, color = '#00cc00' }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

/** Bullet — web signup password feedback list. */
export function BulletIcon({ size = 12, color = '#6b7280' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="12" cy="12" r="6" />
    </Svg>
  );
}

/** Forward arrow — used on CTAs. */
export function ArrowRightIcon({ size = 20, color = '#ffffff', strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Line x1="5" y1="12" x2="19" y2="12" />
      <Polyline points="12 5 19 12 12 19" />
    </Svg>
  );
}

// Re-exported as a RN-friendly wrapper so consumers can render via JSX without
// touching the SVG namespace.
export const Icon = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>{children}</View>
);
