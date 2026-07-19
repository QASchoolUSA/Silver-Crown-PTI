import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, PenLine, Truck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  PTI_STEPS,
  calculateInspectionStatus,
  buildInspectionSections,
  createInspection,
} from '@silver-crown/shared';
import { compressImageUri } from '../lib/imageUtils';
import { mobileStorageUploader } from '../lib/storageUpload';
import { useAuth } from '../context/AuthContext';
import InspectionRow from '../components/InspectionRow';
import SignatureModal from '../components/SignatureModal';
import { colors, typography } from '../theme';

const VEHICLE_STEP = { id: 'vehicle', type: 'Setup', title: 'Unit Identification', items: [] };

function getCheckedCount(step, inspectionData) {
  if (!step?.items?.length) return { checked: 0, total: 0 };
  const section = inspectionData[step.id] || {};
  const checked = step.items.filter((item) => section[item]?.status === 'pass' || section[item]?.status === 'fail').length;
  return { checked, total: step.items.length };
}

export default function NewPTIScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inspectionData, setInspectionData] = useState({});
  const [truckNumber, setTruckNumber] = useState('');
  const [trailerNumber, setTrailerNumber] = useState('');
  const [isSignatureVisible, setIsSignatureVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(1)).current;

  const allSteps = [VEHICLE_STEP, ...PTI_STEPS];
  const currentStep = allSteps[currentStepIndex];
  const totalSteps = allSteps.length;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;
  const isVehicleStep = currentStepIndex === 0;
  const { checked, total } = getCheckedCount(currentStep, inspectionData);

  const truckStepCount = PTI_STEPS.filter((s) => s.type === 'Truck').length;
  const trailerStepCount = PTI_STEPS.filter((s) => s.type === 'Trailer').length;
  const truckProgress = Math.min(
    Math.max(currentStepIndex - 1, 0),
    truckStepCount,
  );
  const trailerProgress = Math.max(currentStepIndex - 1 - truckStepCount, 0);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadDraft();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [progressPercent, progressAnim]);

  const animateStepChange = (nextIndex) => {
    Animated.sequence([
      Animated.timing(contentFade, { toValue: 0.35, duration: 90, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setCurrentStepIndex(nextIndex);
  };

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
      animateStepChange(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      animateStepChange(currentStepIndex - 1);
    } else {
      navigation.goBack();
    }
  };

  const submitInspection = () => {
    setIsSignatureVisible(true);
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
        storageUploader: mobileStorageUploader,
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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (submitting) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.submittingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.submittingTitle}>Submitting inspection</Text>
          <Text style={styles.submittingText}>Uploading photos and securing your signature…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 16) + 4 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn} accessibilityLabel="Go back">
            <ChevronLeft color={colors.onSurface} size={26} />
          </TouchableOpacity>
          <View style={styles.brandBlock}>
            <Text style={styles.brandMark}>SILVER CROWN</Text>
            <Text style={styles.brandProduct}>PRE-TRIP INSPECTION</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{currentStepIndex + 1}/{totalSteps}</Text>
          </View>
        </View>

        <View style={styles.stepMeta}>
          <Text style={styles.headerTitle}>{currentStep.title}</Text>
          <Text style={styles.headerSubtitle}>
            {currentStep.type}
            {!isVehicleStep && total > 0 ? `  ·  ${checked} of ${total} checked` : ''}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        <View style={styles.phaseRow}>
          <View style={styles.phaseItem}>
            <Text style={[styles.phaseLabel, currentStepIndex === 0 && styles.phaseLabelActive]}>UNIT</Text>
            <View style={[styles.phaseDot, currentStepIndex >= 0 && styles.phaseDotDone]} />
          </View>
          <View style={styles.phaseLine} />
          <View style={styles.phaseItem}>
            <Text style={[styles.phaseLabel, currentStep.type === 'Truck' && styles.phaseLabelActive]}>
              TRUCK {truckProgress}/{truckStepCount}
            </Text>
            <View style={[styles.phaseDot, truckProgress > 0 && styles.phaseDotDone, currentStep.type === 'Truck' && styles.phaseDotActive]} />
          </View>
          <View style={styles.phaseLine} />
          <View style={styles.phaseItem}>
            <Text style={[styles.phaseLabel, currentStep.type === 'Trailer' && styles.phaseLabelActive]}>
              TRAILER {trailerProgress}/{trailerStepCount}
            </Text>
            <View style={[styles.phaseDot, trailerProgress > 0 && styles.phaseDotDone, currentStep.type === 'Trailer' && styles.phaseDotActive]} />
          </View>
        </View>
      </View>

      <Animated.View style={[styles.feedWrap, { opacity: contentFade }]}>
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isVehicleStep ? (
            <View style={styles.vehiclePanel}>
              <View style={styles.vehicleHero}>
                <View style={styles.vehicleIconWrap}>
                  <Truck color={colors.primary} size={28} />
                </View>
                <View style={styles.vehicleHeroCopy}>
                  <Text style={styles.vehicleHeroTitle}>Identify your unit</Text>
                  <Text style={styles.vehicleHeroBody}>
                    Enter the equipment IDs before walking the truck and trailer.
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>TRUCK NUMBER *</Text>
              <TextInput
                style={styles.input}
                value={truckNumber}
                onChangeText={(v) => { setTruckNumber(v); saveDraft(inspectionData, v, trailerNumber); }}
                placeholder="TRK-2041"
                placeholderTextColor={colors.outline}
                autoCapitalize="characters"
                accessibilityLabel="Truck number"
              />

              <Text style={styles.label}>TRAILER NUMBER</Text>
              <TextInput
                style={styles.input}
                value={trailerNumber}
                onChangeText={(v) => { setTrailerNumber(v); saveDraft(inspectionData, truckNumber, v); }}
                placeholder="Optional — leave blank if bobtail"
                placeholderTextColor={colors.outline}
                autoCapitalize="characters"
                accessibilityLabel="Trailer number"
              />

              <Text style={styles.helperText}>
                Drafts save automatically if you leave and come back.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionCue}>
                Mark each item Pass or Fail. Add notes and photos for any defect.
              </Text>
              {currentStep.items.map((item) => {
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
              })}
            </>
          )}
        </ScrollView>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {currentStepIndex > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Previous step">
            <Text style={styles.backText}>Previous</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        {currentStepIndex < totalSteps - 1 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} accessibilityLabel="Next step">
            <Text style={styles.nextText}>Continue</Text>
            <ChevronRight color={colors.onPrimary} size={20} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitBtn} onPress={submitInspection} accessibilityLabel="Sign and submit">
            <PenLine color={colors.onPrimary} size={18} />
            <Text style={styles.submitText}>Sign & Submit</Text>
          </TouchableOpacity>
        )}
      </View>

      <SignatureModal visible={isSignatureVisible} onClose={() => setIsSignatureVisible(false)} onSign={handleSign} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  submittingCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: 28,
    paddingVertical: 36,
    width: '100%',
    maxWidth: 340,
  },
  submittingTitle: {
    color: colors.onSurface,
    fontFamily: typography.montserratBold,
    fontSize: 16,
    marginTop: 18,
  },
  submittingText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    marginRight: 10,
  },
  brandBlock: {
    flex: 1,
  },
  brandMark: {
    color: colors.primary,
    fontFamily: typography.montserratBold,
    fontSize: 10,
    letterSpacing: 2,
  },
  brandProduct: {
    color: colors.onSurface,
    fontFamily: typography.bebas,
    fontSize: 26,
    letterSpacing: 1.5,
    marginTop: 1,
    lineHeight: 28,
  },
  stepBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  stepBadgeText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  stepMeta: {
    marginBottom: 12,
  },
  headerTitle: {
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
    fontSize: 18,
  },
  headerSubtitle: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseItem: {
    alignItems: 'center',
    gap: 6,
  },
  phaseLabel: {
    color: colors.outline,
    fontFamily: typography.montserratBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  phaseLabelActive: {
    color: colors.primary,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  phaseDotDone: {
    backgroundColor: 'rgba(137, 206, 255, 0.55)',
    borderColor: colors.primary,
  },
  phaseDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  phaseLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginHorizontal: 8,
    marginTop: 14,
  },
  feedWrap: {
    flex: 1,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionCue: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  vehiclePanel: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 18,
  },
  vehicleHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  vehicleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(137, 206, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(137, 206, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleHeroCopy: {
    flex: 1,
  },
  vehicleHeroTitle: {
    color: colors.onSurface,
    fontFamily: typography.montserratBold,
    fontSize: 16,
  },
  vehicleHeroBody: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  label: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
    fontSize: 18,
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  helperText: {
    color: colors.outline,
    fontFamily: typography.montserrat,
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    minWidth: 88,
  },
  backText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 15,
  },
  backBtnPlaceholder: {
    width: 88,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 4,
  },
  nextText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
