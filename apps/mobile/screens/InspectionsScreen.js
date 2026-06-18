import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Plus } from 'lucide-react-native';
import { subscribeDriverInspections, formatInspectionDate } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import InspectionCard from '../components/InspectionCard';
import { colors, typography } from '../theme';

export default function InspectionsScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [inspections, setInspections] = useState([]);

  useEffect(() => {
    if (!user || !profile?.companyId) return;
    const unsubscribe = subscribeDriverInspections(profile.companyId, user.uid, setInspections);
    return unsubscribe;
  }, [user, profile?.companyId]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {inspections.map((item) => (
          <InspectionCard
            key={item.id}
            date={formatInspectionDate(item.createdAt)}
            vehicleId={item.truckNumber}
            trailerId={item.trailerNumber}
            status={item.status}
            onPress={() => navigation.navigate('InspectionDetail', { inspectionId: item.id })}
          />
        ))}
        {inspections.length === 0 && (
          <Text style={styles.emptyText}>No inspections yet. Start your first PTI below.</Text>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewPTI')}>
        <Plus color={colors.surface} size={24} />
        <Text style={styles.fabText}>Start New Inspection</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  feed: { flex: 1, padding: 16 },
  feedContent: { paddingBottom: 100 },
  emptyText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    left: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  fabText: { color: colors.onPrimary, fontFamily: typography.montserratBold, fontSize: 16 },
});
