import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import {
  createLoad,
  getCompanyDrivers,
  draftsToStops,
  initialStopDrafts,
  getOrderedStops,
} from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import StopAddressEditor from '../components/StopAddressEditor';
import { colors, typography } from '../theme';

const EQUIPMENT_TYPES = ['Dry Van', 'Reefer', 'Flatbed'];

function getRegionFromStops(stops) {
  const coords = stops.map((s) => s.coords);
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.08),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.08),
  };
}

export default function NewLoadScreen({ navigation }) {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [pickups, setPickups] = useState(initialStopDrafts().pickups);
  const [dropoffs, setDropoffs] = useState(initialStopDrafts().dropoffs);
  const [form, setForm] = useState({
    payout: '',
    miles: '',
    deadhead: '0',
    type: 'Dry Van',
    assignedDriverId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.companyId) getCompanyDrivers(profile.companyId).then(setDrivers);
  }, [profile?.companyId]);

  const previewStops = draftsToStops(pickups, dropoffs);
  const orderedStops = previewStops ? getOrderedStops({ stops: previewStops }) : null;
  const routeCoords = orderedStops?.map((s) => s.coords) ?? [];
  const mapRegion = routeCoords.length >= 2 ? getRegionFromStops(orderedStops) : null;

  const handleSubmit = async () => {
    if (!profile?.companyId) return;

    const stops = draftsToStops(pickups, dropoffs);
    if (!stops) {
      setError('Add at least one pickup and one drop-off, and select an address for each stop.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const driver = drivers.find((d) => d.uid === form.assignedDriverId);
      await createLoad({
        companyId: profile.companyId,
        stops,
        payout: form.payout,
        miles: form.miles,
        deadhead: form.deadhead,
        type: form.type,
        assignedDriverId: form.assignedDriverId || null,
        assignedDriverName: driver?.displayName,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <StopAddressEditor
            pickups={pickups}
            dropoffs={dropoffs}
            onPickupsChange={setPickups}
            onDropoffsChange={setDropoffs}
          />

          {mapRegion && routeCoords.length >= 2 && (
            <View style={styles.mapSection}>
              <Text style={styles.sectionLabel}>ROUTE PREVIEW</Text>
              <View style={styles.mapContainer}>
                <MapView style={styles.map} region={mapRegion} scrollEnabled={false} userInterfaceStyle="dark">
                  {orderedStops.map((stop, index) => (
                    <Marker
                      key={`${stop.type}-${stop.sequence}-${index}`}
                      coordinate={stop.coords}
                      pinColor={stop.type === 'dropoff' ? colors.primary : colors.onSurfaceVariant}
                    />
                  ))}
                  <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={3} geodesic />
                </MapView>
              </View>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>PAYOUT ($)</Text>
              <TextInput
                style={styles.input}
                value={form.payout}
                onChangeText={(payout) => setForm({ ...form, payout })}
                keyboardType="numeric"
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>MILES</Text>
              <TextInput
                style={styles.input}
                value={form.miles}
                onChangeText={(miles) => setForm({ ...form, miles })}
                keyboardType="numeric"
                placeholderTextColor={colors.outline}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>DEADHEAD</Text>
              <TextInput
                style={styles.input}
                value={form.deadhead}
                onChangeText={(deadhead) => setForm({ ...form, deadhead })}
                keyboardType="numeric"
                placeholderTextColor={colors.outline}
              />
            </View>
          </View>

          <Text style={styles.label}>EQUIPMENT TYPE</Text>
          <View style={styles.chipRow}>
            {EQUIPMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, form.type === type && styles.chipActive]}
                onPress={() => setForm({ ...form, type })}
              >
                <Text style={[styles.chipText, form.type === type && styles.chipTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>ASSIGN DRIVER</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !form.assignedDriverId && styles.chipActive]}
              onPress={() => setForm({ ...form, assignedDriverId: '' })}
            >
              <Text style={[styles.chipText, !form.assignedDriverId && styles.chipTextActive]}>Unassigned</Text>
            </TouchableOpacity>
            {drivers.map((d) => (
              <TouchableOpacity
                key={d.uid}
                style={[styles.chip, form.assignedDriverId === d.uid && styles.chipActive]}
                onPress={() => setForm({ ...form, assignedDriverId: d.uid })}
              >
                <Text style={[styles.chipText, form.assignedDriverId === d.uid && styles.chipTextActive]}>
                  {d.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitText}>CREATE LOAD</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  mapSection: { marginBottom: 20 },
  mapContainer: { height: 180, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.outlineVariant },
  map: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  col: { flex: 1 },
  label: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.onSurface,
    fontFamily: typography.montserrat,
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.onSurfaceVariant, fontFamily: typography.montserratBold, fontSize: 12 },
  chipTextActive: { color: colors.onPrimary },
  error: { color: colors.error, fontFamily: typography.montserrat, fontSize: 14, marginTop: 12 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 14,
    letterSpacing: 1,
  },
});
