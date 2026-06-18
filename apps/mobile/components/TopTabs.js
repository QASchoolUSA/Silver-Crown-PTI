import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

export default function TopTabs({ tabs, activeTab, onTabChange }) {
  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab;
        return (
          <TouchableOpacity 
            key={tab}
            style={[
              styles.tabBtn, 
              index === 0 ? styles.tabLeft : null,
              index === tabs.length - 1 ? styles.tabRight : null,
              isActive ? styles.tabActive : styles.tabInactive
            ]}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  tabLeft: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderRightWidth: 0,
  },
  tabRight: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderLeftWidth: 0,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabInactive: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  tabText: {
    fontFamily: typography.montserratBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 14,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  tabTextInactive: {
    color: colors.onSurfaceVariant,
  },
});
