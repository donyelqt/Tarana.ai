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
 * show-all rows below the fold). Visual tokens stay Spots-owned (18px
 * gutters, hairline border, 14px blue text, auth-gradient active).
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
        const label = (
          <Text style={[styles.pillText, active && styles.pillTextActive]}>{CITY_CONFIGS[c].name}</Text>
        );
        return active ? (
          <TouchableOpacity
            key={c}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            accessibilityLabel={`${CITY_CONFIGS[c].name} spots, selected`}
            onPress={() => onSelect(c)}
          >
            <LinearGradient
              colors={[GRADIENT.auth.from, GRADIENT.auth.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
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
            accessibilityLabel={`${CITY_CONFIGS[c].name} spots`}
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  pillActive: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pillText: { color: '#0066FF', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
});
