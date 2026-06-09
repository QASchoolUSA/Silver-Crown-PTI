import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';
import { Camera, CheckCircle, XCircle, X } from 'lucide-react-native';
import { colors, typography } from '../theme';

export default function InspectionRow({ 
  item, 
  status, 
  onStatusChange, 
  notes, 
  onNotesChange, 
  onCameraPress, 
  photoUri,
  onPhotoDelete
}) {
  const isFail = status === 'fail';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.itemText}>{item}</Text>
        <View style={styles.actions}>
          <TouchableOpacity 
            onPress={onCameraPress}
            style={[styles.iconBtn, photoUri && styles.photoActiveBg]}
          >
            <Camera color={photoUri ? colors.primary : colors.outlineVariant} size={22} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity 
            onPress={() => onStatusChange('pass')}
            style={[styles.iconBtn, status === 'pass' && styles.passBg]}
          >
            <CheckCircle color={status === 'pass' ? colors.primary : colors.outline} size={24} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => onStatusChange('fail')}
            style={[styles.iconBtn, status === 'fail' && styles.failBg]}
          >
            <XCircle color={status === 'fail' ? colors.error : colors.outline} size={24} />
          </TouchableOpacity>
        </View>
      </View>
      
      {(isFail || notes) && (
        <View style={styles.notesRow}>
          <TextInput 
            style={styles.textInput}
            placeholder="Defect notes..."
            placeholderTextColor={colors.outline}
            value={notes}
            onChangeText={onNotesChange}
          />
        </View>
      )}
      
      {photoUri && (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photoUri }} style={styles.photo} />
          <TouchableOpacity style={styles.deletePhotoBtn} onPress={onPhotoDelete}>
            <X color={colors.surface} size={16} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemText: {
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
    fontSize: 15,
    flex: 1,
    paddingRight: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.outlineVariant,
    marginHorizontal: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 999,
  },
  passBg: {
    backgroundColor: 'rgba(137, 206, 255, 0.2)', // primary with 20% opacity
  },
  failBg: {
    backgroundColor: 'rgba(255, 180, 171, 0.2)', // error with 20% opacity
  },
  photoActiveBg: {
    backgroundColor: 'rgba(137, 206, 255, 0.1)',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHighest,
    color: colors.onSurface,
    fontFamily: typography.montserrat,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    fontSize: 14,
  },
  photoContainer: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 999,
    padding: 2,
  },
});
