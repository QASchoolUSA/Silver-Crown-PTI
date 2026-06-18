import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, TextInput } from 'react-native';
import { Search } from 'lucide-react-native';
import { subscribeCompanyInspections, getCompanyDrivers, formatInspectionDate } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import InspectionCard from '../components/InspectionCard';
import { colors, typography } from '../theme';

export default function AdminInspectionsScreen({ navigation }) {
  const { profile } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filterDriver, setFilterDriver] = useState('All');
  const [truckFilter, setTruckFilter] = useState('');

  useEffect(() => {
    if (!profile?.companyId) return;
    const unsubscribe = subscribeCompanyInspections(profile.companyId, setInspections);
    getCompanyDrivers(profile.companyId).then(setDrivers);
    return unsubscribe;
  }, [profile?.companyId]);

  const filtered = inspections.filter((item) => {
    const matchesDriver = filterDriver === 'All' || item.driverId === filterDriver;
    const matchesTruck = !truckFilter || item.truckNumber.toLowerCase().includes(truckFilter.toLowerCase());
    return matchesDriver && matchesTruck;
  });

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.searchBar}>
          <Search color={colors.outline} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by truck number"
            placeholderTextColor={colors.outline}
            value={truckFilter}
            onChangeText={setTruckFilter}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setFilterDriver('All')}
            style={[styles.chip, filterDriver === 'All' && styles.chipActive]}
          >
            <Text style={[styles.chipText, filterDriver === 'All' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {drivers.map((d) => (
            <TouchableOpacity
              key={d.uid}
              onPress={() => setFilterDriver(d.uid)}
              style={[styles.chip, filterDriver === d.uid && styles.chipActive]}
            >
              <Text style={[styles.chipText, filterDriver === d.uid && styles.chipTextActive]}>{d.displayName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {filtered.map((item) => (
          <View key={item.id}>
            <Text style={styles.driverLabel}>{item.driverName}</Text>
            <InspectionCard
              date={formatInspectionDate(item.createdAt)}
              vehicleId={item.truckNumber}
              trailerId={item.trailerNumber}
              status={item.status}
              onPress={() => navigation.navigate('InspectionDetail', { inspectionId: item.id })}
            />
          </View>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.emptyText}>No inspections found.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  filters: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: typography.montserrat, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceContainerHigh, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.onSurfaceVariant, fontFamily: typography.montserratBold, fontSize: 12 },
  chipTextActive: { color: colors.onPrimary },
  feed: { flex: 1, padding: 16 },
  feedContent: { paddingBottom: 40 },
  driverLabel: { color: colors.primary, fontFamily: typography.montserratSemiBold, fontSize: 11, marginBottom: 4, marginLeft: 4, textTransform: 'uppercase' },
  emptyText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, textAlign: 'center', marginTop: 40 },
});
