import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { subscribeCompanyLoads, getCompanyDrivers } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import LoadCard from '../components/LoadCard';
import TopTabs from '../components/TopTabs';
import { colors, typography } from '../theme';

export default function AdminLoadsScreen() {
  const { profile } = useAuth();
  const [loads, setLoads] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [activeTab, setActiveTab] = useState('All Loads');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterDriver, setFilterDriver] = useState('All');

  useEffect(() => {
    if (!profile?.companyId) return;
    const unsubscribe = subscribeCompanyLoads(profile.companyId, setLoads);
    getCompanyDrivers(profile.companyId).then(setDrivers);
    return unsubscribe;
  }, [profile?.companyId]);

  const availableLoads = loads.filter((l) => l.status === 'available' || l.status === 'in_transit');
  const pastLoads = loads.filter((l) => l.status === 'delivered');
  const activeData = activeTab === 'All Loads' ? loads : activeTab === 'Active' ? availableLoads : pastLoads;

  const filteredLoads = activeData.filter((load) => {
    const matchesSearch =
      load.origin.toLowerCase().includes(search.toLowerCase()) ||
      load.destination.toLowerCase().includes(search.toLowerCase()) ||
      (load.assignedDriverName || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === 'All' || load.type === filterType;
    const matchesDriver = filterDriver === 'All' || load.assignedDriverId === filterDriver;
    return matchesSearch && matchesFilter && matchesDriver;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TopTabs tabs={['All Loads', 'Active', 'Delivered']} activeTab={activeTab} onTabChange={setActiveTab} />

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={colors.outline} size={20} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search loads or driver"
              placeholderTextColor={colors.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.driverFilter}>
            <TouchableOpacity
              onPress={() => setFilterDriver('All')}
              style={[styles.filterChip, filterDriver === 'All' ? styles.filterChipActive : styles.filterChipInactive]}
            >
              <Text style={[styles.filterChipText, filterDriver === 'All' ? styles.filterChipTextActive : styles.filterChipTextInactive]}>All Drivers</Text>
            </TouchableOpacity>
            {drivers.map((d) => (
              <TouchableOpacity
                key={d.uid}
                onPress={() => setFilterDriver(d.uid)}
                style={[styles.filterChip, filterDriver === d.uid ? styles.filterChipActive : styles.filterChipInactive]}
              >
                <Text style={[styles.filterChipText, filterDriver === d.uid ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                  {d.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
            {['All', 'Dry Van', 'Reefer', 'Flatbed'].map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setFilterType(type)}
                style={[styles.filterChip, filterType === type ? styles.filterChipActive : styles.filterChipInactive]}
              >
                <Text style={[styles.filterChipText, filterType === type ? styles.filterChipTextActive : styles.filterChipTextInactive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {filteredLoads.map((load) => (
          <View key={load.id}>
            {load.assignedDriverName && (
              <Text style={styles.driverLabel}>Driver: {load.assignedDriverName}</Text>
            )}
            <LoadCard
              origin={load.origin}
              destination={load.destination}
              payout={load.payout}
              miles={load.miles}
              rightLabel={load.status === 'delivered' ? 'Delivery' : 'Deadhead'}
              rightValue={load.status === 'delivered' ? load.deliveryDate || '—' : `${load.deadhead || '0'} mi`}
              originCoords={load.originCoords}
              destCoords={load.destCoords}
              onBook={() => {}}
            />
          </View>
        ))}
        {filteredLoads.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No loads found.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  searchContainer: { marginTop: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 12 },
  searchIcon: { marginLeft: 8 },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: typography.montserrat, marginLeft: 12, fontSize: 16, paddingVertical: 8 },
  driverFilter: { marginBottom: 8 },
  filterOptions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipInactive: { backgroundColor: colors.surfaceContainerHigh },
  filterChipText: { fontSize: 12, fontFamily: typography.montserratBold },
  filterChipTextActive: { color: colors.onPrimary },
  filterChipTextInactive: { color: colors.onSurfaceVariant },
  feed: { flex: 1, padding: 16 },
  feedContent: { paddingBottom: 40 },
  driverLabel: { color: colors.primary, fontFamily: typography.montserratSemiBold, fontSize: 12, marginBottom: 4, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 16 },
});
