import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import InspectionRow from '../components/InspectionRow';
import SignatureModal from '../components/SignatureModal';
import { colors, typography } from '../theme';

const ALL_STEPS = [
  // Truck Steps
  { id: 'engine', type: 'Truck', title: 'Engine Compartment', items: ['Oil Level', 'Coolant Level', 'Belts & Hoses'] },
  { id: 'cab', type: 'Truck', title: 'Cab/Start', items: ['Oil Pressure Gauge', 'Wipers', 'Horn', 'Mirrors'] },
  { id: 'lights', type: 'Truck', title: 'Lights/Reflectors', items: ['Headlights', 'Turn Signals', 'Reflectors'] },
  { id: 'brakes', type: 'Truck', title: 'Brakes', items: ['Air Leaks', 'Brake Shoes/Drums'] },
  { id: 'tires', type: 'Truck', title: 'Tires/Wheels', items: ['Tire Tread', 'Lug Nuts'] },
  // Trailer Steps
  { id: 'coupling', type: 'Trailer', title: 'Coupling System', items: ['Fifth Wheel', 'Kingpin'] },
  { id: 'air', type: 'Trailer', title: 'Air Lines', items: ['Glad Hands', 'Air Hoses'] },
  { id: 'gear', type: 'Trailer', title: 'Landing Gear', items: ['Crank Handle', 'Legs'] },
  { id: 'tires_trl', type: 'Trailer', title: 'Tires', items: ['Tire Tread', 'Lug Nuts'] },
  { id: 'lights_trl', type: 'Trailer', title: 'Tail/Brake Lights', items: ['Brake Lights', 'Turn Signals'] },
];

export default function NewPTIScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inspectionData, setInspectionData] = useState({});

  const [isSignatureVisible, setIsSignatureVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const currentStep = ALL_STEPS[currentStepIndex];
  const totalSteps = ALL_STEPS.length;
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;

  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = async () => {
    try {
      const draft = await AsyncStorage.getItem('@pti_draft');
      if (draft) {
        setInspectionData(JSON.parse(draft));
      }
    } catch (e) {
      console.log('Error loading draft', e);
    }
  };

  const saveDraft = async (data) => {
    try {
      await AsyncStorage.setItem('@pti_draft', JSON.stringify(data));
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
    saveDraft(newData);
  };

  const handleNext = () => {
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

  const handleSign = async (signatureBase64) => {
    setIsSignatureVisible(false);
    // In a real app, we would upload signatureBase64 and the inspectionData to the server here.
    
    await AsyncStorage.removeItem('@pti_draft');
    setInspectionData({});
    Alert.alert("Success", "Inspection completed and signed.");
    navigation.goBack();
  };

  const handleCameraPress = async (sectionId, item) => {
    // Request permissions
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission to access camera is required!");
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      updateItem(sectionId, item, 'photoUri', result.assets[0].uri);
    }
  };

  const handlePhotoDelete = (sectionId, item) => {
    updateItem(sectionId, item, 'photoUri', null);
  };

  return (
    <View style={styles.container}>
      {/* Super Compact Custom Header */}
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

      {/* Main Content */}
      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {currentStep.items.map(item => {
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
      </ScrollView>

      {/* Compact Bottom Navigation */}
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
            <Text style={styles.submitText}>REVIEW</Text>
            <CheckSquare color={colors.surface} size={18} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
      </View>

      <SignatureModal 
        visible={isSignatureVisible} 
        onClose={() => setIsSignatureVisible(false)} 
        onSign={handleSign} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  headerBackBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.onSurface,
    fontFamily: typography.bebas,
    fontSize: 24,
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: colors.primary,
    fontFamily: typography.montserratSemiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  headerSpacer: {
    width: 32, // to balance the back button
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  feed: {
    flex: 1,
    padding: 12,
  },
  feedContent: {
    paddingBottom: 40,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  backText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 14,
  },
  backBtnPlaceholder: {
    width: 80,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  nextText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 14,
    marginRight: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  submitText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 14,
  },
});
