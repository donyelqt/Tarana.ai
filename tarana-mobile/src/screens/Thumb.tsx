import { useState } from 'react';
import { Image, View } from 'react-native';

/**
 * Thumb — remote image with graceful absence (canonical helper).
 *
 * Rules: `uri` must already be resolved (data `resolveWebImage`); null
 * renders nothing (caller lays out text-only). Any load failure hides the
 * slot instead of showing broken-image UI. Fixed pixel size keeps list
 * rows from reflowing when images arrive late (no CLS).
 */
export default function Thumb({
  uri,
  size,
  radius = 12,
}: {
  uri: string | null;
  size: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#ffffff' }}
    >
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
