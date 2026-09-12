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
import Svg, { Path, Polyline, Circle, Line, Polygon } from 'react-native-svg';

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

/** Google "G" mark — exact path data from web `src/app/auth/signin/page.tsx` (viewBox 0 0 48 48). */
export function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M24 9.5c3.54 0 6.46 1.22 8.47 3.23l6.32-6.32C34.91 2.69 29.89 0 24 0 14.82 0 6.73 5.82 2.69 14.09l7.75 6.02C12.13 13.62 17.57 9.5 24 9.5z"
      />
      <Path
        fill="#34A853"
        d="M46.1 24.55c0-1.64-.15-3.21-.43-4.73H24v9.01h12.41c-.54 2.9-2.18 5.36-4.64 7.01l7.17 5.57C43.93 37.19 46.1 31.38 46.1 24.55z"
      />
      <Path
        fill="#FBBC05"
        d="M10.44 28.11a14.5 14.5 0 010-8.22l-7.75-6.02A23.97 23.97 0 000 24c0 3.77.9 7.34 2.69 10.23l7.75-6.12z"
      />
      <Path
        fill="#EA4335"
        d="M24 48c6.49 0 11.94-2.15 15.92-5.86l-7.17-5.57c-2.01 1.35-4.59 2.16-8.75 2.16-6.43 0-11.87-4.12-13.56-9.61l-7.75 6.12C6.73 42.18 14.82 48 24 48z"
      />
    </Svg>
  );
}

/** Map pin — Trips tab. Same stroke language as the set (2.0 at tab size). */
export function MapPinIcon({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
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
      <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

/** Compass — Spots tab. */
export function CompassIcon({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
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
      <Circle cx="12" cy="12" r="10" />
      <Polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </Svg>
  );
}

/** Utensils — Eats tab. */
export function UtensilsIcon({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
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
      <Path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <Path d="M7 2v20" />
      <Path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </Svg>
  );
}

/** Gear — Settings tab. */
export function GearIcon({ size = 24, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
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
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

/** Plus — center action button. Same stroke language (2.5 at large size). */
export function PlusIcon({ size = 28, color = '#ffffff', strokeWidth = 2.5 }: IconProps) {
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
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}

/** Tilt cube — Explore 3D toggle. Simple geometric mark, same stroke language. */
export function TiltIcon({ size = 20, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
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
      <Path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <Path d="M3 8l9 5 9-5" />
      <Path d="M12 13v8" />
    </Svg>
  );
}

/** Layers — Explore map-style toggle. Simple geometric mark, same stroke language. */export function LayersIcon({ size = 20, color = '#9ca3af', strokeWidth = 2 }: IconProps) {
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
      <Path d="M12 2l9 5-9 5-9-5 9-5z" />
      <Path d="M3 12l9 5 9-5" />
      <Path d="M3 17l9 5 9-5" />
    </Svg>
  );
}

/**
 * Explore transport glyphs — primitive-composed (circle/line/rect), NOT
 * traced Lucide paths. lucide-react is Metro-blocked, and the skill bans
 * hand-drawn paths; composing from primitives is the allowed path.
 * Same 24-viewBox stroke language as the set.
 */
export function CarIcon({ size = 16, color = '#6b7280', strokeWidth = 2 }: IconProps) {
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
      <Path d="M4 16v-5l2-5h11l3 5h1v5" />
      <Path d="M4 12h16" />
      <Circle cx="8" cy="17.5" r="1.8" />
      <Circle cx="16.5" cy="17.5" r="1.8" />
    </Svg>
  );
}

export function WalkIcon({ size = 16, color = '#6b7280', strokeWidth = 2 }: IconProps) {
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
      <Circle cx="13" cy="4" r="1.8" />
      <Path d="M13 8l-2.5 5 2.5 3v5" />
      <Path d="M10.5 13L7 14.5" />
      <Path d="M10.5 13l3-1.5 2.5 1" />
      <Path d="M13 16l3 2 1 3" />
    </Svg>
  );
}

export function BikeIcon({ size = 16, color = '#6b7280', strokeWidth = 2 }: IconProps) {
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
      <Circle cx="6" cy="16.5" r="3.5" />
      <Circle cx="18" cy="16.5" r="3.5" />
      <Path d="M6 16.5l3.5-7H14l4 7" />
      <Path d="M9.5 9.5L8 5.5h2.5" />
    </Svg>
  );
}

export function TruckIcon({ size = 16, color = '#6b7280', strokeWidth = 2 }: IconProps) {
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
      <Path d="M2 6h12v10H2z" />
      <Path d="M14 10h4l3 3v3h-7" />
      <Circle cx="6.5" cy="17.5" r="1.8" />
      <Circle cx="17" cy="17.5" r="1.8" />
    </Svg>
  );
}

/** Sliders — Explore options toggle. Primitive-composed, same stroke language. */
export function SlidersIcon({ size = 16, color = '#6b7280', strokeWidth = 2 }: IconProps) {
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
      <Line x1="4" y1="7" x2="20" y2="7" />
      <Line x1="4" y1="12" x2="20" y2="12" />
      <Line x1="4" y1="17" x2="20" y2="17" />
      <Circle cx="9" cy="7" r="2" fill="#ffffff" />
      <Circle cx="15" cy="12" r="2" fill="#ffffff" />
      <Circle cx="8" cy="17" r="2" fill="#ffffff" />
    </Svg>
  );
}

// Re-exported as a RN-friendly wrapper so consumers can render via JSX without
// touching the SVG namespace.
export const Icon = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>{children}</View>
);
