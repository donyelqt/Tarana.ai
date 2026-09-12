import { StyleSheet, Text, View } from 'react-native';
import type { ExploreMapProps } from './ExploreMapView.native';

/**
 * Web-export fallback: react-native-webview has no web implementation, so
 * the Metro `-p web` smoke gate renders this instead of breaking. The
 * interactive TomTom map needs a device build (or Expo Go).
 */
export default function ExploreMapView(_props: ExploreMapProps) {
  return (
    <View style={styles.fill}>
      <Text style={styles.text}>Interactive map needs a device build.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
});
