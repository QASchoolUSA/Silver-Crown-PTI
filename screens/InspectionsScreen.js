import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Plus } from 'lucide-react-native';
import InspectionCard from '../components/InspectionCard';
import { colors, typography } from '../theme';

const MOCK_HISTORY = [
  { id: '1', date: 'Oct 24, 2023 - 06:30 AM', vehicleId: 'TRK-2041', trailerId: 'TRL-992', status: 'PASS' },
  { id: '2', date: 'Oct 23, 2023 - 05:15 PM', vehicleId: 'TRK-2041', trailerId: 'TRL-992', status: 'DEFECTS FOUND' },
  { id: '3', date: 'Oct 23, 2023 - 06:00 AM', vehicleId: 'TRK-2041', trailerId: 'TRL-992', status: 'PASS' },
  { id: '4', date: 'Oct 22, 2023 - 06:15 AM', vehicleId: 'TRK-2041', trailerId: null, status: 'PASS' },
];

export default function InspectionsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {MOCK_HISTORY.map(item => (
          <InspectionCard 
            key={item.id}
            date={item.date}
            vehicleId={item.vehicleId}
            trailerId={item.trailerId}
            status={item.status}
            onPress={() => navigation.navigate('InspectionDetail', { inspectionId: item.id, item })}
          />
        ))}
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('NewPTI')}
      >
        <Plus color={colors.surface} size={24} />
        <Text style={styles.fabText}>Start New Inspection</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  feed: {
    flex: 1,
    padding: 16,
  },
  feedContent: {
    paddingBottom: 100, // extra padding for FAB
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: colors.surface,
    fontFamily: typography.montserratBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
});
