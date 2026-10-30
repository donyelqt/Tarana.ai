import { useState } from 'react';
import { Image, View } from 'react-native';

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
