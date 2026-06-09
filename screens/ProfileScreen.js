import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>SC</Text>
      </View>
      <Text style={styles.title}>Driver Profile</Text>
      <Text style={styles.subtitle}>Silver Crown Global</Text>

      <TouchableOpacity style={styles.menuBtn}>
        <Text style={styles.menuText}>Account Settings</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.menuBtn}>
        <Text style={styles.menuText}>App Preferences</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 48,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 32,
    fontFamily: typography.bebas,
  },
  title: {
    color: colors.onSurface,
    fontSize: 32,
    fontFamily: typography.bebas,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.onSurfaceVariant,
    fontSize: 16,
    fontFamily: typography.montserrat,
    marginBottom: 32,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  menuBtn: {
    backgroundColor: colors.surfaceContainer,
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: 16,
  },
  menuText: {
    color: colors.onSurface,
    fontFamily: typography.montserrat,
    fontSize: 16,
  },
  signOutBtn: {
    backgroundColor: 'rgba(255, 180, 171, 0.2)', // error-container with opacity
    width: '100%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.errorContainer,
    marginTop: 40,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.error,
    fontFamily: typography.montserratBold,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
