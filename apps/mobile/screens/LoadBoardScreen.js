import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { subscribeDriverLoads } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import LoadCard from '../components/LoadCard';
import TopTabs from '../components/TopTabs';
import { colors, typography } from '../theme';

export default function LoadBoardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [loads, setLoads] = useState([]);
  const [activeTab, setActiveTab] = useState('Available Loads');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user || !profile?.companyId) return;
    const unsubscribe = subscribeDriverLoads(profile.companyId, user.uid, setLoads);
    return unsubscribe;
  }, [user, profile?.companyId]);

  const availableLoads = loads.filter((l) => l.status === 'available' || l.status === 'in_transit');
  const pastLoads = loads.filter((l) => l.status === 'delivered');
  const activeData = activeTab === 'Available Loads' ? availableLoads : pastLoads;

  const filteredLoads = activeData.filter((load) => {
    const matchesSearch =
      load.origin.toLowerCase().includes(search.toLowerCase()) ||
      load.destination.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === 'All' || load.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TopTabs tabs={['Available Loads', 'Past Loads']} activeTab={activeTab} onTabChange={setActiveTab} />

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search color={colors.outline} size={20} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Origin or Destination"
              placeholderTextColor={colors.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Equipment:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>
              {['All', 'Dry Van', 'Reefer', 'Flatbed'].map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFilterType(type)}
                  style={[styles.filterChip, filterType === type ? styles.filterChipActive : styles.filterChipInactive]}
                >
                  <Text style={[styles.filterChipText, filterType === type ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={colors.primary} />}
      >
        {filteredLoads.map((load) => (
          <LoadCard
            key={load.id}
            origin={load.origin}
            destination={load.destination}
            payout={load.payout}
            miles={load.miles}
            rightLabel={activeTab === 'Available Loads' ? 'Deadhead' : 'Delivery'}
            rightValue={activeTab === 'Available Loads' ? `${load.deadhead || '0'} mi` : load.deliveryDate || '—'}
            stops={load.stops}
            originCoords={load.originCoords}
            destCoords={load.destCoords}
            onBook={() => navigation.navigate('LoadDetail', { loadId: load.id })}
          />
        ))}
        {filteredLoads.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No loads assigned to you yet.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  searchContainer: { marginTop: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 12 },
  searchIcon: { marginLeft: 8 },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: typography.montserrat, marginLeft: 12, fontSize: 16, paddingVertical: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  filterLabel: { color: colors.onSurfaceVariant, fontFamily: typography.montserratSemiBold, marginRight: 8 },
  filterOptions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipInactive: { backgroundColor: colors.surfaceContainerHigh },
  filterChipText: { fontSize: 12, fontFamily: typography.montserratBold },
  filterChipTextActive: { color: colors.onPrimary },
  filterChipTextInactive: { color: colors.onSurfaceVariant },
  feed: { flex: 1, padding: 16 },
  feedContent: { paddingBottom: 40 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 16 },
});
