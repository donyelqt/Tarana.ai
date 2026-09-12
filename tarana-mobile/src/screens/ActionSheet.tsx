import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

const ACTIONS = [
  {
    route: 'Plan' as const,
    title: 'Itinerary plan',
    sub: 'Build a day-by-day trip',
  },
  {
    route: 'Eats' as const,
    title: 'Tarana Eats',
    sub: 'Find a meal in Baguio',
  },
  {
    route: 'Explore' as const,
    title: 'Explore',
    sub: 'Live directions with traffic',
  },
];

/**
 * ActionSheet — the center-tab action (transparent modal over the tabs).
 *
 * Three feature destinations, one tap each. `replace` (not navigate) so
 * the sheet never stacks: dismissing the destination returns to the tab
 * that opened it. Backdrop and Cancel both goBack — back never traps.
 */
export default function ActionSheet({ navigation }: { navigation: any }) {
  const go = (route: string) => {
    navigation.replace(route);
  };

  return (
    <View style={styles.backdrop}>
      <TouchableOpacity
        style={styles.dismiss}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => navigation.goBack()}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.route}
            style={styles.option}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={a.title}
            onPress={() => go(a.route)}
          >
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{a.title}</Text>
              <Text style={styles.optionSub}>{a.sub}</Text>
            </View>
            <LinearGradient
              colors={[BLUE, BLUE_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.go}
            >
              <Text style={styles.goText}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.cancel}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.4)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  optionSub: { fontSize: 13, color: '#6b7280' },
  go: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  goText: { color: '#ffffff', fontSize: 20, fontWeight: '600', lineHeight: 22 },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 15, color: BLUE, fontWeight: '600' },
});
