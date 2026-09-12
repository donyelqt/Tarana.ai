/**
 * Mobile landing page — mirrors the WEB app's mobile-view design.
 *
 * Composition of the web landing sections, recomposed single-column for a
 * phone (per the Phase 3b design contract: shared brand language, not a
 * verbatim port of the desktop markup):
 *   - HeroSection: headline + subcopy + gradient CTA
 *   - HowItWorksSection: the 3-step strip
 *   - Footer: the "Ready to Plan Less and Enjoy More?" CTA
 *
 * Metro-safe: no `next/image`, no `lucide-react`, no `GeminiSparkles`
 * (web-only). Logo ships from `assets/icon.png`; step icons are
 * react-native-svg (raw `<svg>` red-screens on native — bundling green
 * proves nothing here). City names come from the shared `cityConfig` so the
 * copy stays in sync with the web app.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Polyline } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { getCityConfig } from 'tarana-web/data/cityConfig';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const BRAND_BLUE = '#0066FF';
const BRAND_BLUE_LIGHT = '#1E90FF';
const CITY_ID = 'baguio' as const;
const city = getCityConfig(CITY_ID);

type RootStackParamList = {
  AuthEntry: undefined;
  Home: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AuthEntry'>;

type IconProps = { size?: number; color?: string; strokeWidth?: number };

function ChevronRight({ size = 20, color = '#111827' }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function StepIcon({ step }: { step: 1 | 2 | 3 }) {
  // Inline SVG stand-ins for the web step images (set / letai / explore),
  // which live in `public/` and are unreachable from Metro.
  const paths: Record<1 | 2 | 3, string> = {
    1: 'M4 6h16M4 12h16M4 18h10', // checklist / "set your trip details"
    2: 'M12 3v4m0 10v4m-4-7h8a3 3 0 010 6h-2', // spark / "let AI handle"
    3: 'M3 12a9 9 0 0118 0 9 9 0 01-18 0z M9 12l2 2 4-4', // compass / "explore"
  };
  return (
    <Svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke={BRAND_BLUE}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={paths[step]} />
    </Svg>
  );
}

export default function Landing() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.logoPill}>
            <Image
              source={require('../../assets/icon.png')}
              accessibilityRole="image"
              accessibilityLabel="Tarana.ai logo"
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.headline}>
            Your {city.name} trip,{'\n'}
            <Text style={styles.headlineAccent}>planned in seconds.</Text>
          </Text>
          <Text style={styles.subcopy}>
            Itineraries tuned to your budget, interests, group, and live traffic.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Plan my Baguio trip"
            onPress={() => navigation.navigate('AuthEntry')}
            style={styles.ctaOuter}
          >
            <LinearGradient
              colors={[BRAND_BLUE, BRAND_BLUE_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Plan My {city.name} Trip</Text>
              <ChevronRight size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── How It Works ─────────────────────────────────────── */}
        <View style={styles.howSection}>
          <Text style={styles.sectionTitle}>How it Works</Text>

          <View style={styles.step}>
            <StepIcon step={1} />
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Set Your Trip Details</Text>
              <Text style={styles.stepText}>
                Input your budget, number of people, stay duration, and what you love.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <StepIcon step={2} />
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Let AI Handle the Planning</Text>
              <Text style={styles.stepText}>
                We instantly create a day-by-day itinerary optimized for your style and the city{'\n'}s
                real-time conditions.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <StepIcon step={3} />
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Explore {city.name} Effortlessly</Text>
              <Text style={styles.stepText}>
                Get a beautiful, ready-to-go plan — from places to eat to shortcuts around traffic. All on
                one screen.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Footer CTA ───────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Ready to Plan Less and Enjoy More?</Text>
          <Text style={styles.footerSub}>Get your personalized {city.name} itinerary in under a minute.</Text>
          <Text style={styles.footerSub}>Tap below to start your smart travel experience.</Text>

          <TouchableOpacity
            style={styles.footerCta}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Start my trip"
            onPress={() => navigation.navigate('AuthEntry')}
          >
            <Text style={styles.footerCtaText}>Plan My {city.name} Trip</Text>
            <ChevronRight size={20} color={BRAND_BLUE} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  container: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 40 },

  hero: { alignItems: 'center' },
  logoPill: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  logo: { width: 110, height: 110 },
  headline: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
    lineHeight: 44,
    marginBottom: 16,
  },
  headlineAccent: { color: BRAND_BLUE },
  subcopy: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    marginBottom: 32,
  },
  ctaOuter: {
    borderRadius: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 8,
  },
  ctaText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },

  howSection: { marginTop: 48, alignItems: 'center' },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: BRAND_BLUE,
    marginBottom: 32,
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    gap: 16,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 6 },
  stepText: { fontSize: 14, color: '#4b5563', lineHeight: 20 },

  footer: {
    marginTop: 56,
    backgroundColor: BRAND_BLUE,
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerTitle: { fontSize: 26, fontWeight: '600', color: '#ffffff', marginBottom: 8, textAlign: 'center' },
  footerSub: { fontSize: 16, color: '#dbeafe', marginBottom: 8, textAlign: 'center' },
  footerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginTop: 8,
    gap: 8,
  },
  footerCtaText: { color: BRAND_BLUE, fontSize: 17, fontWeight: '600' },
});
