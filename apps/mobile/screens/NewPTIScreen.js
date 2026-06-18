import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  PTI_STEPS,
  calculateInspectionStatus,
  buildInspectionSections,
  createInspection,
} from '@silver-crown/shared';
import { compressImageUri } from '../lib/imageUtils';
import { useAuth } from '../context/AuthContext';
import InspectionRow from '../components/InspectionRow';
import SignatureModal from '../components/SignatureModal';
import { colors, typography } from '../theme';

const VEHICLE_STEP = { id: 'vehicle', type: 'Info', title: 'Vehicle Information', items: [] };

export default function NewPTIScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inspectionData, setInspectionData] = useState({});
  const [truckNumber, setTruckNumber] = useState('');
  const [trailerNumber, setTrailerNumber] = useState('');
  const [isSignatureVisible, setIsSignatureVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allSteps = [VEHICLE_STEP, ...PTI_STEPS];
  const currentStep = allSteps[currentStepIndex];
  const totalSteps = allSteps.length;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;
  const isVehicleStep = currentStepIndex === 0;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem('@pti_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setInspectionData(parsed.data || {});
        setTruckNumber(parsed.truckNumber || '');
        setTrailerNumber(parsed.trailerNumber || '');
      }
    } catch (e) {
      console.log('Error loading draft', e);
    }
  };

  const saveDraft = async (data, truck, trailer) => {
    try {
      await AsyncStorage.setItem('@pti_draft', JSON.stringify({ data, truckNumber: truck, trailerNumber: trailer }));
    } catch (e) {
      console.log('Error saving draft', e);
    }
  };

  const updateItem = (sectionId, item, field, value) => {
    const newData = { ...inspectionData };
    if (!newData[sectionId]) newData[sectionId] = {};
    if (!newData[sectionId][item]) newData[sectionId][item] = { status: null, notes: '', photoUri: null };
    newData[sectionId][item][field] = value;
    setInspectionData(newData);
    saveDraft(newData, truckNumber, trailerNumber);
  };

  const handleNext = () => {
    if (isVehicleStep && !truckNumber.trim()) {
      Alert.alert('Required', 'Please enter your truck number.');
      return;
    }
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    } else {
      navigation.goBack();
    }
  };

  const submitInspection = () => {
    setIsSignatureVisible(true);
  };

  const fetchBlob = async (uri) => {
    const response = await fetch(uri);
    return response.blob();
  };

  const handleSign = async (signatureBase64) => {
    setIsSignatureVisible(false);
    setSubmitting(true);

    try {
      const photoUris = {};
      for (const [sectionId, items] of Object.entries(inspectionData)) {
        for (const [itemName, itemData] of Object.entries(items)) {
          if (itemData.photoUri) {
            photoUris[`${sectionId}::${itemName}`] = await compressImageUri(itemData.photoUri);
          }
        }
      }

      const sections = buildInspectionSections(inspectionData);
      const status = calculateInspectionStatus(inspectionData);

      await createInspection({
        companyId: profile.companyId,
        driverId: user.uid,
        driverName: profile.displayName,
        truckNumber: truckNumber.trim(),
        trailerNumber: trailerNumber.trim() || null,
        status,
        sections,
        signatureBase64,
        photoUris,
        fetchBlob,
      });

      await AsyncStorage.removeItem('@pti_draft');
      setInspectionData({});
      setTruckNumber('');
      setTrailerNumber('');
      Alert.alert('Success', 'Inspection completed and signed.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit inspection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCameraPress = async (sectionId, item) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission to access camera is required!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.4,
    });
    if (!result.canceled) {
      updateItem(sectionId, item, 'photoUri', result.assets[0].uri);
    }
  };

  const handlePhotoDelete = (sectionId, item) => {
    updateItem(sectionId, item, 'photoUri', null);
  };

  if (submitting) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.submittingText}>Uploading inspection...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 16 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn}>
            <ChevronLeft color={colors.onSurface} size={28} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{currentStep.title}</Text>
            <Text style={styles.headerSubtitle}>
              Step {currentStepIndex + 1} of {totalSteps} • {currentStep.type}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {isVehicleStep ? (
          <View style={styles.vehicleForm}>
            <Text style={styles.label}>TRUCK NUMBER *</Text>
            <TextInput
              style={styles.input}
              value={truckNumber}
              onChangeText={(v) => { setTruckNumber(v); saveDraft(inspectionData, v, trailerNumber); }}
              placeholder="TRK-2041"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
            />
            <Text style={styles.label}>TRAILER NUMBER</Text>
            <TextInput
              style={styles.input}
              value={trailerNumber}
              onChangeText={(v) => { setTrailerNumber(v); saveDraft(inspectionData, truckNumber, v); }}
              placeholder="TRL-992 (optional)"
              placeholderTextColor={colors.outline}
              autoCapitalize="characters"
            />
          </View>
        ) : (
          currentStep.items.map((item) => {
            const itemData = inspectionData[currentStep.id]?.[item] || {};
            return (
              <InspectionRow
                key={item}
                item={item}
                status={itemData.status}
                onStatusChange={(val) => updateItem(currentStep.id, item, 'status', val)}
                notes={itemData.notes || ''}
                onNotesChange={(val) => updateItem(currentStep.id, item, 'notes', val)}
                onCameraPress={() => handleCameraPress(currentStep.id, item)}
                photoUri={itemData.photoUri}
                onPhotoDelete={() => handlePhotoDelete(currentStep.id, item)}
              />
            );
          })
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom || 16 }]}>
        {currentStepIndex > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backText}>PREVIOUS</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        {currentStepIndex < totalSteps - 1 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>NEXT STEP</Text>
            <ChevronRight color={colors.surface} size={20} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitBtn} onPress={submitInspection}>
            <Text style={styles.submitText}>SIGN & SUBMIT</Text>
            <CheckSquare color={colors.surface} size={18} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
      </View>

      <SignatureModal visible={isSignatureVisible} onClose={() => setIsSignatureVisible(false)} onSign={handleSign} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: { alignItems: 'center', justifyContent: 'center' },
  submittingText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, marginTop: 16 },
  header: { paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  headerBackBtn: { padding: 4, marginLeft: -4 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.onSurface, fontFamily: typography.bebas, fontSize: 24, letterSpacing: 1 },
  headerSubtitle: { color: colors.primary, fontFamily: typography.montserratSemiBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  headerSpacer: { width: 32 },
  progressTrack: { height: 4, backgroundColor: colors.surfaceContainerHigh, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  feed: { flex: 1, padding: 12 },
  feedContent: { paddingBottom: 40 },
  vehicleForm: { padding: 8 },
  label: { color: colors.onSurfaceVariant, fontFamily: typography.montserratBold, fontSize: 11, letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.surfaceContainerHigh, borderRadius: 8, padding: 14, color: colors.onSurface, fontFamily: typography.montserrat, fontSize: 16, borderWidth: 1, borderColor: colors.outlineVariant },
  footer: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.surfaceContainerLow, borderTopWidth: 1, borderTopColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { paddingVertical: 10, paddingHorizontal: 8 },
  backText: { color: colors.onSurfaceVariant, fontFamily: typography.montserratBold, fontSize: 14 },
  backBtnPlaceholder: { width: 80 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  nextText: { color: colors.onPrimary, fontFamily: typography.montserratBold, fontSize: 14, marginRight: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  submitText: { color: colors.onPrimary, fontFamily: typography.montserratBold, fontSize: 14 },
});
