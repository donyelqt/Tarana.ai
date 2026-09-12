import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Switch, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { config } from '../config';
import { getActiveProfile, signOut, type LocalProfile } from '../data';
import { fetchWeather } from '../data';
import { GradientCTA } from './ui';

const API_BASE = config.webBaseUrl.replace(/\/$/, '');

type SettingsNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
  replace: (route: string) => void;
};

export default function Settings({ navigation }: { navigation: SettingsNav }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weather, setWeather] = useState<{ temperature: number | null; condition: string | null; iconUrl: string | null } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Original profile values for change detection
  const [originalProfile, setOriginalProfile] = useState<LocalProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getActiveProfile();
      setProfile(p);
      setOriginalProfile(p);
      if (p) {
        setFullName(p.display_name ?? '');
        setLocation(p.location ?? '');
        setBio(p.bio ?? '');
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Check for changes
  useEffect(() => {
    if (!originalProfile) return;
    const changed = 
      fullName !== (originalProfile.display_name ?? '') ||
      location !== (originalProfile.location ?? '') ||
      bio !== (originalProfile.bio ?? '');
    setHasChanges(changed);
  }, [fullName, location, bio, originalProfile]);

  // Load weather for Baguio
  useEffect(() => {
    let mounted = true;
    setWeatherLoading(true);
    fetchWeather(16.4023, 120.596)
      .then(w => {
        if (mounted) {
          setWeather(w);
          setWeatherLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setWeatherLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (!hasChanges) return;
    
    // Validation
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full name is required');
      return;
    }
    if (fullName.length > 100) {
      Alert.alert('Validation Error', 'Full name must be less than 100 characters');
      return;
    }
    if (location.length > 200) {
      Alert.alert('Validation Error', 'Location must be less than 200 characters');
      return;
    }
    if (bio.length > 500) {
      Alert.alert('Validation Error', 'Bio must be less than 500 characters');
      return;
    }

    setSaving(true);
    try {
      // TODO: Implement profile update API call
      // For now, just update local state
      // In a real implementation, you'd call an API to update the profile
      console.log('Saving profile:', { fullName, location, bio });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local profile
      const updatedProfile = { ...profile!, display_name: fullName, location, bio };
      setProfile(updatedProfile);
      
      Alert.alert('Success', 'Profile updated successfully');
      setHasChanges(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openTerms = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/terms`);
  };

  const openPrivacy = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/privacy`);
  };

  const onSignOut = async () => {
    setShowSignOutConfirm(false);
    await signOut();
    navigation.replace('Landing');
  };

  const openLinkAccount = () => {
    navigation.navigate('AuthEntry', { mode: 'import' });
  };

  const firstName = profile?.display_name?.split(' ')[0] ?? 'Traveler';
  const initial = (firstName[0] ?? 'T').toUpperCase();

  const weatherTemp = weather?.temperature != null ? Math.round(weather.temperature) : '—';
  const weatherCondition = weather?.condition ?? '—';
  const weatherIcon = weather?.iconUrl;

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#0066FF" size="large" />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{firstName}</Text>
            <Text style={styles.subtitle}>Settings</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarLarge} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>{initial}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileFields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  maxLength={100}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="name"
                />
                <Text style={styles.charCount}>{fullName.length}/100</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={profile?.email ?? ''}
                  editable={false}
                  placeholder="Email"
                />
                <Text style={styles.fieldHint}>Cannot be changed</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Location</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g., Baguio City, Philippines"
                  maxLength={200}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <Text style={styles.charCount}>{location.length}/200</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself..."
                  maxLength={500}
                  multiline
                  numberOfLines={4}
                  autoCapitalize="sentences"
                />
                <Text style={styles.charCount}>{bio.length}/500</Text>
              </View>
            </View>
          </View>
          {hasChanges ? (
            <View style={styles.saveButton}>
              <GradientCTA
                variant="app"
                title="Save Changes"
                loading={saving}
                loadingTitle="Saving…"
                disabled={saving}
                onPress={handleSave}
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Email Notifications</Text>
              <Text style={styles.toggleDesc}>Receive updates about your trips via email</Text>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: '#d1d5db', true: '#0066FF' }}
              thumbColor={emailNotifications ? '#ffffff' : '#f3f4f6'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>In-App Notifications</Text>
              <Text style={styles.toggleDesc}>Receive notifications within the app</Text>
            </View>
            <Switch
              value={inAppNotifications}
              onValueChange={setInAppNotifications}
              trackColor={{ false: '#d1d5db', true: '#0066FF' }}
              thumbColor={inAppNotifications ? '#ffffff' : '#f3f4f6'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weather</Text>
        <View style={styles.card}>
          <View style={styles.weatherRow}>
            {weatherLoading ? (
              <ActivityIndicator size="small" color="#0066FF" />
            ) : weatherIcon ? (
              <Image source={{ uri: weatherIcon }} style={styles.weatherIcon} />
            ) : (
              <View style={styles.weatherIconPlaceholder} />
            )}
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherTitle}>Baguio Weather</Text>
              <Text style={styles.weatherTemp}>{weatherTemp}°C</Text>
              <Text style={styles.weatherCondition}>{weatherCondition}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={openLinkAccount}
            activeOpacity={0.7}
            accessibilityLabel="Link web account"
          >
            <Text style={styles.linkText}>Link web account</Text>
            <Text style={styles.linkChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={openTerms}
            activeOpacity={0.7}
            accessibilityLabel="Terms of Service"
          >
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={openPrivacy}
            activeOpacity={0.7}
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => setShowSignOutConfirm(true)}
            activeOpacity={0.7}
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showSignOutConfirm && (
        <View style={styles.modalOverlay} onTouchEnd={() => setShowSignOutConfirm(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalText}>Are you sure you want to sign out? Your local data will remain on this device.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowSignOutConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={onSignOut}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Everything stays on this device.</Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, flexGrow: 1 },
  header: { marginBottom: 8 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#0066FF' },
  avatarLarge: { width: 72, height: 72, borderRadius: 36 },
  avatarContainer: { marginRight: 12 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 28, fontWeight: '700', color: '#0066FF' },
  headerText: { flex: 1 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', lineHeight: 28 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarContainerProfile: { flexShrink: 0 },
  avatarPlaceholderLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderTextLarge: { fontSize: 28, fontWeight: '700', color: '#0066FF' },
  profileFields: { flex: 1, gap: 16 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  fieldHint: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
  },
  inputDisabled: { backgroundColor: '#f9fafb', color: '#9ca3af' },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  fieldHintBottom: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  saveButton: { marginTop: 4 },
  sectionBottom: { marginBottom: 16 },
  sectionTitleBottom: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  toggleDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: -16 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weatherIcon: { width: 48, height: 48 },
  weatherIconPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#eff6ff' },
  weatherInfo: { flex: 1 },
  weatherTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  weatherTemp: { fontSize: 28, fontWeight: '700', color: '#111827', lineHeight: 34 },
  weatherCondition: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  linkText: { fontSize: 15, color: '#0066FF', fontWeight: '500' },
  linkChevron: { fontSize: 18, color: '#9ca3af', fontWeight: '300' },
  signOutButton: { paddingVertical: 14, alignItems: 'center' },
  signOutText: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  modal: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  modalButtonConfirm: { backgroundColor: '#dc2626' },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
  modalButtonConfirmText: { color: '#ffffff' },
  footer: { marginTop: 24, paddingVertical: 16, alignItems: 'center', gap: 4 },
  footerText: { fontSize: 13, color: '#6b7280' },
  versionText: { fontSize: 12, color: '#9ca3af' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6b7280' },
});