import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import LoadCard from '../components/LoadCard';
import TopTabs from '../components/TopTabs';
import { colors, typography } from '../theme';

const MOCK_AVAILABLE_LOADS = [
  { 
    id: '1', origin: 'Chicago, IL', destination: 'Dallas, TX', payout: '2,400', miles: '920', deadhead: '45', type: 'Dry Van', status: 'available',
    originCoords: { latitude: 41.8781, longitude: -87.6298 }, destCoords: { latitude: 32.7767, longitude: -96.7970 }
  },
  { 
    id: '2', origin: 'Atlanta, GA', destination: 'Miami, FL', payout: '1,850', miles: '660', deadhead: '12', type: 'Reefer', status: 'available',
    originCoords: { latitude: 33.7490, longitude: -84.3880 }, destCoords: { latitude: 25.7617, longitude: -80.1918 }
  },
  { 
    id: '3', origin: 'Seattle, WA', destination: 'Los Angeles, CA', payout: '3,100', miles: '1135', deadhead: '80', type: 'Flatbed', status: 'available',
    originCoords: { latitude: 47.6062, longitude: -122.3321 }, destCoords: { latitude: 34.0522, longitude: -118.2437 }
  },
];

const MOCK_PAST_LOADS = [
  { 
    id: '4', origin: 'Denver, CO', destination: 'Phoenix, AZ', payout: '1,950', miles: '860', type: 'Dry Van', status: 'delivered', deliveryDate: 'Oct 20, 2023',
    originCoords: { latitude: 39.7392, longitude: -104.9903 }, destCoords: { latitude: 33.4484, longitude: -112.0740 }
  },
  { 
    id: '5', origin: 'Houston, TX', destination: 'Austin, TX', payout: '800', miles: '165', type: 'Flatbed', status: 'delivered', deliveryDate: 'Oct 18, 2023',
    originCoords: { latitude: 29.7604, longitude: -95.3698 }, destCoords: { latitude: 30.2672, longitude: -97.7431 }
  },
];

export default function LoadBoardScreen() {
  const [activeTab, setActiveTab] = useState('Available Loads');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');

  const activeData = activeTab === 'Available Loads' ? MOCK_AVAILABLE_LOADS : MOCK_PAST_LOADS;

  const filteredLoads = activeData.filter(load => {
    const matchesSearch = load.origin.toLowerCase().includes(search.toLowerCase()) || 
                          load.destination.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === 'All' || load.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TopTabs 
          tabs={['Available Loads', 'Past Loads']} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
        
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
              {['All', 'Dry Van', 'Reefer', 'Flatbed'].map(type => (
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

      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {filteredLoads.map(load => (
          <LoadCard 
            key={load.id}
            origin={load.origin}
            destination={load.destination}
            payout={load.payout}
            miles={load.miles}
            rightLabel={activeTab === 'Available Loads' ? 'Deadhead' : 'Delivery'}
            rightValue={activeTab === 'Available Loads' ? `${load.deadhead} mi` : load.deliveryDate}
            originCoords={load.originCoords}
            destCoords={load.destCoords}
            onBook={() => {}}
          />
        ))}
        {filteredLoads.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No loads found matching criteria.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  searchContainer: {
    marginTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.onSurface,
    fontFamily: typography.montserrat,
    marginLeft: 12,
    fontSize: 16,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratSemiBold,
    marginRight: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipInactive: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: typography.montserratBold,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },
  filterChipTextInactive: {
    color: colors.onSurfaceVariant,
  },
  feed: {
    flex: 1,
    padding: 16,
  },
  feedContent: {
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 16,
  },
});
