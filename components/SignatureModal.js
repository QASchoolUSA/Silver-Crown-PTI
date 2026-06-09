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
    // signature is a base64 encoded png
    onSign(signature);
  };

  // Inject CSS to style the HTML5 canvas inside the WebView to match our app's dark theme
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
      border: 1px solid ${colors.outlineVariant};
      border-radius: 8px;
      background-color: ${colors.surfaceContainerHigh};
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
          <Text style={styles.title}>Driver Signature</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color={colors.onSurfaceVariant} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            By signing below, I certify that I have thoroughly inspected this vehicle 
            in accordance with FMCSA regulations and the information provided is true and correct.
          </Text>
        </View>

        <View style={styles.canvasContainer}>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleOK}
            webStyle={webStyle}
            autoClear={false}
            descriptionText=""
            penColor={colors.onSurface}
            backgroundColor={colors.surfaceContainerHigh}
          />
          <Text style={styles.watermark} pointerEvents="none">Sign Here</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Eraser color={colors.onSurfaceVariant} size={20} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Submit Inspection</Text>
            <Check color={colors.surface} size={20} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  title: {
    color: colors.onSurface,
    fontFamily: typography.bebas,
    fontSize: 28,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  infoBox: {
    padding: 20,
    backgroundColor: colors.surfaceContainer,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  infoText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  canvasContainer: {
    flex: 1,
    margin: 20,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    textAlign: 'center',
    color: colors.outlineVariant,
    fontFamily: typography.bebas,
    fontSize: 48,
    opacity: 0.3,
    marginTop: -24,
    zIndex: -1,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 40,
    justifyContent: 'space-between',
    gap: 16,
  },
  clearBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  clearText: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 16,
    marginLeft: 8,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  confirmText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 16,
    marginRight: 8,
  },
});
