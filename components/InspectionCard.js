import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FileText, Share2 } from 'lucide-react-native';
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
      
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.borderRight]}>
          <FileText color={colors.primary} size={16} />
          <Text style={styles.actionTextPrimary}>VIEW PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Share2 color={colors.onSurface} size={16} />
          <Text style={styles.actionText}>SHARE / EXPORT</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 12,
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
    backgroundColor: 'rgba(0, 180, 255, 0.2)', // primary-container with opacity
  },
  badgeFail: {
    backgroundColor: 'rgba(147, 0, 10, 0.2)', // error-container with opacity
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
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant,
  },
  actionTextPrimary: {
    color: colors.primary,
    fontFamily: typography.montserratSemiBold,
    marginLeft: 8,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionText: {
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
    marginLeft: 8,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
