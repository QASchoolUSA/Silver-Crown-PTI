import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import { X, Eraser, Check } from 'lucide-react-native';
import { colors, typography } from '../theme';

export default function SignatureModal({ visible, onClose, onSign }) {
  const signatureRef = useRef(null);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
  };

  const handleConfirm = () => {
    signatureRef.current?.readSignature();
  };

  const handleOK = (signature) => {
    onSign(signature);
  };

  const webStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      background-color: transparent;
      margin: 0;
      padding: 0;
      height: 100%;
    }
    .m-signature-pad--body {
      border: none;
      border-radius: 12px;
      background-color: #ffffff;
      bottom: 0px;
      top: 0px;
      left: 0px;
      right: 0px;
    }
    .m-signature-pad--footer {
      display: none;
    }
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>FINAL STEP</Text>
            <Text style={styles.title}>Certify & Sign</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close signature">
            <X color={colors.onSurfaceVariant} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            By signing, I certify that I inspected this vehicle under FMCSA rules and that the
            information provided is true and correct.
          </Text>
        </View>

        <View style={styles.canvasContainer}>
          <Text style={styles.canvasLabel}>DRIVER SIGNATURE</Text>
          <View style={styles.canvasFrame}>
            <SignatureScreen
              ref={signatureRef}
              onOK={handleOK}
              webStyle={webStyle}
              autoClear={false}
              descriptionText=""
              penColor="#1a1a1f"
              backgroundColor="#ffffff"
            />
            <Text style={styles.watermark} pointerEvents="none">Sign here</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} accessibilityLabel="Clear signature">
            <Eraser color={colors.onSurfaceVariant} size={18} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} accessibilityLabel="Submit inspection">
            <Text style={styles.confirmText}>Submit Inspection</Text>
            <Check color={colors.onPrimary} size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: typography.montserratBold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: colors.onSurface,
    fontFamily: typography.bebas,
    fontSize: 34,
    letterSpacing: 1.5,
    lineHeight: 36,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  infoBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  infoText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 13,
    lineHeight: 20,
  },
  canvasContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  canvasLabel: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  canvasFrame: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    top: '46%',
    width: '100%',
    textAlign: 'center',
    color: '#b8b8c0',
    fontFamily: typography.bebas,
    fontSize: 42,
    letterSpacing: 2,
    opacity: 0.55,
    zIndex: -1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 8,
  },
  clearText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 15,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    gap: 8,
  },
  confirmText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 15,
  },
});
