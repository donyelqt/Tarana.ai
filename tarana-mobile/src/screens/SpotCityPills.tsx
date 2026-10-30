import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import { GRADIENT } from './ui';

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
