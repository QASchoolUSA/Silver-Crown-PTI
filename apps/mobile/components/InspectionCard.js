import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

export default function InspectionCard({ date, vehicleId, trailerId, status, onPress }) {
  const isPass = status === 'PASS';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.info}>
          <Text style={styles.dateText}>{date}</Text>
          <Text style={styles.vehicleText}>
            Truck: <Text style={styles.boldText}>{vehicleId}</Text>
            {trailerId && <Text> • Trailer: <Text style={styles.boldText}>{trailerId}</Text></Text>}
          </Text>
        </View>
        <View style={[styles.badge, isPass ? styles.badgePass : styles.badgeFail]}>
          <Text style={[styles.badgeText, isPass ? styles.badgeTextPass : styles.badgeTextFail]}>
            {isPass ? 'PASS' : 'DEFECTS FOUND'}
          </Text>
        </View>
      </View>
      <Text style={styles.tapHint}>Tap to view details</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    padding: 16,
    borderRadius: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
  },
  dateText: {
    color: colors.onSurface,
    fontFamily: typography.montserratBold,
    fontSize: 18,
  },
  vehicleText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 14,
    marginTop: 4,
  },
  boldText: {
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 8,
  },
  badgePass: {
    backgroundColor: 'rgba(0, 180, 255, 0.2)',
  },
  badgeFail: {
    backgroundColor: 'rgba(147, 0, 10, 0.2)',
  },
  badgeText: {
    fontFamily: typography.montserratBold,
    fontSize: 12,
  },
  badgeTextPass: {
    color: colors.primary,
  },
  badgeTextFail: {
    color: colors.error,
  },
  tapHint: {
    color: colors.primary,
    fontFamily: typography.montserratSemiBold,
    fontSize: 12,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
