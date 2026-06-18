import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Share,
  SafeAreaView,
} from 'react-native';
import { CheckCircle, XCircle, FileText, X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { getInspectionById, formatInspectionDate, generateInspectionPdfHtml } from '@silver-crown/shared';
import { colors, typography } from '../theme';

export default function InspectionDetailScreen({ route }) {
  const { inspectionId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    getInspectionById(inspectionId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [inspectionId]);

  const handleShareReport = async () => {
    if (!data) return;
    try {
      await Share.share({
        message: `PTI Report — ${data.truckNumber} — ${data.status}\nDriver: ${data.driverName}\n${formatInspectionDate(data.createdAt)}`,
        title: 'Inspection Report',
      });
    } catch {
      // user cancelled
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>Inspection not found.</Text>
      </View>
    );
  }

  const isPass = data.status === 'PASS';
  const reportHtml = generateInspectionPdfHtml(data);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        <View style={styles.headerCard}>
          <View style={styles.headerInfo}>
            <Text style={styles.dateText}>{formatInspectionDate(data.createdAt)}</Text>
            <Text style={styles.vehicleText}>
              Truck: <Text style={styles.boldText}>{data.truckNumber}</Text>
              {data.trailerNumber && (
                <Text> • Trailer: <Text style={styles.boldText}>{data.trailerNumber}</Text></Text>
              )}
            </Text>
            <Text style={styles.driverText}>Driver: {data.driverName}</Text>
          </View>
          <View style={[styles.badge, isPass ? styles.badgePass : styles.badgeFail]}>
            <Text style={[styles.badgeText, isPass ? styles.badgeTextPass : styles.badgeTextFail]}>{data.status}</Text>
          </View>
        </View>

        <View style={styles.reportActions}>
          <TouchableOpacity style={styles.pdfBtn} onPress={() => setShowReport(true)}>
            <FileText color={colors.primary} size={20} />
            <Text style={styles.pdfBtnText}>View Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareReport}>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {data.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <View key={i} style={[styles.itemRow, i < section.items.length - 1 && styles.itemBorder]}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.notes && <Text style={styles.itemNotes}>Note: {item.notes}</Text>}
                    {item.photoUrl && <Image source={{ uri: item.photoUrl }} style={styles.photo} />}
                  </View>
                  <View style={styles.itemStatus}>
                    {item.status === 'pass' ? (
                      <CheckCircle color={colors.primary} size={24} />
                    ) : item.status === 'fail' ? (
                      <XCircle color={colors.error} size={24} />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {data.signatureUrl && (
          <View style={styles.signatureSection}>
            <Text style={styles.sectionTitle}>Driver Signature</Text>
            <Image source={{ uri: data.signatureUrl }} style={styles.signature} resizeMode="contain" />
          </View>
        )}
      </ScrollView>

      <Modal visible={showReport} animationType="slide" onRequestClose={() => setShowReport(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>INSPECTION REPORT</Text>
            <TouchableOpacity onPress={() => setShowReport(false)} style={styles.closeBtn}>
              <X color={colors.onSurface} size={24} />
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: reportHtml }}
            style={styles.webview}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat },
  content: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 40 },
  headerCard: { backgroundColor: colors.surfaceContainerHigh, padding: 16, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerInfo: { flex: 1 },
  dateText: { color: colors.onSurface, fontFamily: typography.montserratBold, fontSize: 18 },
  vehicleText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 14, marginTop: 4 },
  driverText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 13, marginTop: 4 },
  boldText: { color: colors.onSurface, fontFamily: typography.montserratSemiBold },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginLeft: 8 },
  badgePass: { backgroundColor: 'rgba(0, 180, 255, 0.2)' },
  badgeFail: { backgroundColor: 'rgba(147, 0, 10, 0.2)' },
  badgeText: { fontFamily: typography.montserratBold, fontSize: 12 },
  badgeTextPass: { color: colors.primary },
  badgeTextFail: { color: colors.error },
  reportActions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pdfBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.surfaceContainer, padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary },
  pdfBtnText: { color: colors.primary, fontFamily: typography.montserratBold, fontSize: 14, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  shareBtn: { paddingHorizontal: 20, justifyContent: 'center', backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, borderWidth: 1, borderColor: colors.outlineVariant },
  shareBtnText: { color: colors.onSurface, fontFamily: typography.montserratBold, fontSize: 14, textTransform: 'uppercase' },
  section: { marginBottom: 24 },
  sectionTitle: { color: colors.onSurfaceVariant, fontFamily: typography.montserratBold, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: colors.surfaceContainer, borderRadius: 8, borderWidth: 1, borderColor: colors.outlineVariant },
  itemRow: { flexDirection: 'row', padding: 16, alignItems: 'center', justifyContent: 'space-between' },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  itemInfo: { flex: 1, paddingRight: 16 },
  itemName: { color: colors.onSurface, fontFamily: typography.montserratSemiBold, fontSize: 16 },
  itemNotes: { color: colors.error, fontFamily: typography.montserrat, fontSize: 14, marginTop: 4 },
  photo: { width: 80, height: 60, borderRadius: 4, marginTop: 8 },
  itemStatus: { justifyContent: 'center', alignItems: 'center' },
  signatureSection: { marginBottom: 24 },
  signature: { width: '100%', height: 120, backgroundColor: colors.surfaceContainerHigh, borderRadius: 8 },
  modalContainer: { flex: 1, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  modalTitle: { color: colors.onSurface, fontFamily: typography.bebas, fontSize: 24, letterSpacing: 1 },
  closeBtn: { padding: 4 },
  webview: { flex: 1, backgroundColor: '#fff' },
});
