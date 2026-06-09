import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, XCircle, FileText } from 'lucide-react-native';
import { colors, typography } from '../theme';

// Mock data structure for details
const MOCK_DETAIL = {
  id: '2',
  date: 'Oct 23, 2023 - 05:15 PM',
  vehicleId: 'TRK-2041',
  trailerId: 'TRL-992',
  status: 'DEFECTS FOUND',
  sections: [
    {
      title: 'Engine Compartment',
      items: [
        { name: 'Oil Level', status: 'pass' },
        { name: 'Coolant Level', status: 'pass' },
        { name: 'Belts & Hoses', status: 'fail', notes: 'Alternator belt slightly frayed.' },
      ]
    },
    {
      title: 'Tires/Wheels',
      items: [
        { name: 'Tire Tread (Steers)', status: 'pass' },
        { name: 'Lug Nuts', status: 'pass' },
      ]
    }
  ]
};

export default function InspectionDetailScreen({ route }) {
  // Normally, we'd use route.params.inspectionId to fetch data
  const data = MOCK_DETAIL;
  const isPass = data.status === 'PASS';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.dateText}>{data.date}</Text>
            <Text style={styles.vehicleText}>
              Truck: <Text style={styles.boldText}>{data.vehicleId}</Text>
              {data.trailerId && <Text> • Trailer: <Text style={styles.boldText}>{data.trailerId}</Text></Text>}
            </Text>
          </View>
          <View style={[styles.badge, isPass ? styles.badgePass : styles.badgeFail]}>
            <Text style={[styles.badgeText, isPass ? styles.badgeTextPass : styles.badgeTextFail]}>
              {data.status}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.pdfBtn}>
          <FileText color={colors.primary} size={20} />
          <Text style={styles.pdfBtnText}>Download PDF Report</Text>
        </TouchableOpacity>

        {data.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <View key={i} style={[styles.itemRow, i < section.items.length - 1 && styles.itemBorder]}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.notes && (
                      <Text style={styles.itemNotes}>Note: {item.notes}</Text>
                    )}
                  </View>
                  <View style={styles.itemStatus}>
                    {item.status === 'pass' ? (
                      <CheckCircle color={colors.primary} size={24} />
                    ) : (
                      <XCircle color={colors.error} size={24} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.surfaceContainerHigh,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerInfo: {
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
  pdfBtn: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 24,
  },
  pdfBtnText: {
    color: colors.primary,
    fontFamily: typography.montserratBold,
    fontSize: 16,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  itemRow: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 16,
  },
  itemName: {
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
    fontSize: 16,
  },
  itemNotes: {
    color: colors.error,
    fontFamily: typography.montserrat,
    fontSize: 14,
    marginTop: 4,
  },
  itemStatus: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
