import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signOut, getCompany } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import { colors, typography } from '../theme';

export default function ProfileScreen() {
  const { profile } = useAuth();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (profile?.companyId) {
      getCompany(profile.companyId).then((c) => setCompanyName(c?.name || ''));
    }
  }, [profile?.companyId]);

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SC';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.title}>{profile?.displayName || 'Profile'}</Text>
      <Text style={styles.subtitle}>{companyName || 'Silver Crown Global'}</Text>

      <View style={[styles.roleBadge, profile?.role === 'admin' ? styles.adminBadge : styles.driverBadge]}>
        <Text style={styles.roleText}>{profile?.role === 'admin' ? 'ADMIN' : 'DRIVER'}</Text>
      </View>

      <Text style={styles.email}>{profile?.email}</Text>

      <TouchableOpacity style={styles.menuBtn}>
        <Text style={styles.menuText}>Account Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 16, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, backgroundColor: colors.surfaceContainerHigh, borderRadius: 48, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 32, fontFamily: typography.bebas },
  title: { color: colors.onSurface, fontFamily: typography.bebas, fontSize: 32, letterSpacing: 1 },
  subtitle: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 16, marginBottom: 12 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  adminBadge: { backgroundColor: 'rgba(0, 180, 255, 0.2)' },
  driverBadge: { backgroundColor: colors.surfaceContainerHigh },
  roleText: { color: colors.primary, fontFamily: typography.montserratBold, fontSize: 12, letterSpacing: 1 },
  email: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 14, marginBottom: 32 },
  menuBtn: { width: '100%', backgroundColor: colors.surfaceContainer, padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: colors.outlineVariant },
  menuText: { color: colors.onSurface, fontFamily: typography.montserratSemiBold, fontSize: 16, textAlign: 'center' },
  signOutBtn: { width: '100%', backgroundColor: colors.errorContainer, padding: 16, borderRadius: 8, marginTop: 24 },
  signOutText: { color: colors.error, fontFamily: typography.montserratBold, fontSize: 16, textAlign: 'center' },
});
