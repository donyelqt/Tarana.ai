import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import { GRADIENT } from './ui';

/**
 * City pills row — pure StyleSheet, zero className (matches Home's pills).
 *
 * Layout rule this module depends on: a horizontal lane must sit under
 * UNBOUNDED height (a vertical ScrollView root, like Home's hub). As a
 * direct child of a bounded flex:1 View the lane adopts the remaining
 * space and the pills stretch — that was the giant-pills bug. Spots root
 * is a ScrollView for exactly this reason (which also un-cuts the
 * show-all rows below the fold). Visual tokens follow Home's pills
 * (white + hairline border inactive, 13px blue text, app-gradient
 * vertical active).
 */
export default function SpotCityPills({
  cities,
  city,
  onSelect,
}: {
  cities: CityId[];
  city: CityId;
  onSelect: (c: CityId) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pills}
      style={styles.pillsWrap}
    >
      {cities.map((c) => {
        const active = c === city;
        // Short names like Home ("Baguio", not "Baguio City").
        const shortName = CITY_CONFIGS[c].name.replace(/ City$/, '');
        const label = (
          <Text style={[styles.pillText, active && styles.pillTextActive]}>{shortName}</Text>
        );
        return active ? (
          <TouchableOpacity
            key={c}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
                accessibilityLabel={`${shortName} spots, selected`}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={() => onSelect(c)}
              >
                <LinearGradient
                  colors={[GRADIENT.app.from, GRADIENT.app.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.pillActive}
                >
              {label}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            key={c}
            style={styles.pill}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: false }}
                accessibilityLabel={`${shortName} spots`}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={() => onSelect(c)}
          >
            {label}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pillsWrap: { marginHorizontal: -16, paddingHorizontal: 16, marginBottom: 12 },
  pills: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  pill: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActive: {
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pillText: { color: '#0066FF', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
});
