import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';
import { Camera, Check, X, Trash2 } from 'lucide-react-native';
import { colors, typography } from '../theme';

export default function InspectionRow({
  item,
  status,
  onStatusChange,
  notes,
  onNotesChange,
  onCameraPress,
  photoUri,
  onPhotoDelete,
}) {
  const isFail = status === 'fail';
  const isPass = status === 'pass';

  return (
    <View style={[styles.row, isFail && styles.rowFail, isPass && styles.rowPass]}>
      <Text style={styles.itemText}>{item}</Text>

      <View style={styles.verdictRow}>
        <TouchableOpacity
          onPress={() => onStatusChange('pass')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: isPass }}
          accessibilityLabel={`${item} pass`}
          style={[styles.verdictBtn, styles.passBtn, isPass && styles.passBtnActive]}
        >
          <Check color={isPass ? colors.onPrimary : colors.primary} size={18} strokeWidth={2.5} />
          <Text style={[styles.verdictLabel, isPass ? styles.passLabelActive : styles.passLabel]}>
            PASS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onStatusChange('fail')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: isFail }}
          accessibilityLabel={`${item} fail`}
          style={[styles.verdictBtn, styles.failBtn, isFail && styles.failBtnActive]}
        >
          <X color={isFail ? colors.onError : colors.error} size={18} strokeWidth={2.5} />
          <Text style={[styles.verdictLabel, isFail ? styles.failLabelActive : styles.failLabel]}>
            FAIL
          </Text>
        </TouchableOpacity>
      </View>

      {(isFail || notes) && (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>DEFECT NOTES{isFail ? ' *' : ''}</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe the defect..."
            placeholderTextColor={colors.outline}
            value={notes}
            onChangeText={onNotesChange}
            multiline
          />
        </View>
      )}

      <View style={styles.evidenceRow}>
        {photoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.deletePhotoBtn}
              onPress={onPhotoDelete}
              accessibilityLabel="Remove photo"
            >
              <Trash2 color={colors.onError} size={14} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={onCameraPress}
          activeOpacity={0.8}
          style={[styles.photoBtn, photoUri && styles.photoBtnFilled]}
          accessibilityLabel={photoUri ? 'Retake photo' : 'Add photo'}
        >
          <Camera color={photoUri ? colors.primary : colors.onSurfaceVariant} size={16} />
          <Text style={[styles.photoBtnText, photoUri && styles.photoBtnTextActive]}>
            {photoUri ? 'RETAKE PHOTO' : 'ADD PHOTO'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  rowPass: {
    borderColor: 'rgba(137, 206, 255, 0.35)',
    backgroundColor: 'rgba(137, 206, 255, 0.06)',
  },
  rowFail: {
    borderColor: 'rgba(255, 180, 171, 0.4)',
    backgroundColor: 'rgba(147, 0, 10, 0.18)',
  },
  itemText: {
    color: colors.onSurface,
    fontFamily: typography.montserratSemiBold,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 14,
  },
  verdictRow: {
    flexDirection: 'row',
    gap: 10,
  },
  verdictBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 12,
  },
  passBtn: {
    borderColor: 'rgba(137, 206, 255, 0.45)',
    backgroundColor: colors.surfaceContainerHigh,
  },
  passBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  failBtn: {
    borderColor: 'rgba(255, 180, 171, 0.45)',
    backgroundColor: colors.surfaceContainerHigh,
  },
  failBtnActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  verdictLabel: {
    fontFamily: typography.montserratBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  passLabel: {
    color: colors.primary,
  },
  passLabelActive: {
    color: colors.onPrimary,
  },
  failLabel: {
    color: colors.error,
  },
  failLabelActive: {
    color: colors.onError,
  },
  notesBlock: {
    marginTop: 14,
  },
  notesLabel: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.surfaceContainerHighest,
    color: colors.onSurface,
    fontFamily: typography.montserrat,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  evidenceRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 999,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerHigh,
  },
  photoBtnFilled: {
    borderColor: 'rgba(137, 206, 255, 0.4)',
    backgroundColor: 'rgba(137, 206, 255, 0.08)',
  },
  photoBtnText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  photoBtnTextActive: {
    color: colors.primary,
  },
});
