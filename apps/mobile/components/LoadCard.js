import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, typography } from '../theme';

export default function LoadCard({ origin, destination, payout, miles, rightLabel = "Deadhead", rightValue, originCoords, destCoords, onBook, showActions = true }) {
  
  // Calculate region to fit both coordinates
  const getRegion = () => {
    if (!originCoords || !destCoords) return null;
    const minLat = Math.min(originCoords.latitude, destCoords.latitude);
    const maxLat = Math.max(originCoords.latitude, destCoords.latitude);
    const minLng = Math.min(originCoords.longitude, destCoords.longitude);
    const maxLng = Math.max(originCoords.longitude, destCoords.longitude);

    const latDelta = (maxLat - minLat) * 1.5 || 0.1;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.1;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  const region = getRegion();

  return (
    <View style={styles.card}>
      {region && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={region}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            userInterfaceStyle="dark" // Forces Apple Maps dark mode
            mapType="standard"
          >
            <Marker coordinate={originCoords} pinColor={colors.onSurfaceVariant} title="Origin" />
            <Marker coordinate={destCoords} pinColor={colors.primary} title="Destination" />
            <Polyline 
              coordinates={[originCoords, destCoords]} 
              strokeColor={colors.primary} 
              strokeWidth={3} 
              geodesic={true}
            />
          </MapView>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.routeText}>
            {origin} <Text style={styles.arrowText}>➔</Text> {destination}
          </Text>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Payout</Text>
            <Text style={styles.metricValuePrimary}>${payout}</Text>
          </View>
          <View style={styles.metricColCenter}>
            <Text style={styles.metricLabelCenter}>Total Miles</Text>
            <Text style={styles.metricValue}>{miles} mi</Text>
          </View>
          <View style={styles.metricColRight}>
            <Text style={styles.metricLabelRight}>{rightLabel}</Text>
            <Text style={styles.metricValue}>{rightValue}</Text>
          </View>
        </View>
        {showActions && (
        <TouchableOpacity style={styles.button} onPress={onBook}>
          <Text style={styles.buttonText}>VIEW DETAILS</Text>
        </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden', // Ensures map doesn't spill out of rounded corners
  },
  mapContainer: {
    height: 120, // Reduced height for the map snippet
    width: '100%',
    backgroundColor: colors.surfaceContainerHigh,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeText: {
    color: colors.onSurface,
    fontFamily: typography.bebas,
    fontSize: 24,
    flex: 1,
    textTransform: 'uppercase',
  },
  arrowText: {
    color: colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCol: {
    justifyContent: 'flex-start',
  },
  metricColCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricColRight: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricLabelCenter: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  metricLabelRight: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  metricValue: {
    color: colors.onSurface,
    fontFamily: typography.montserratBold,
    fontSize: 18,
  },
  metricValuePrimary: {
    color: colors.primary,
    fontFamily: typography.montserratBold,
    fontSize: 18,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 16,
  },
});
