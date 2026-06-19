import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { getRoutePolyline, getOrderedStops } from '@silver-crown/shared';
import { colors, typography } from '../theme';

function getRegionFromCoords(coordsList) {
  if (!coordsList || coordsList.length === 0) return null;

  const lats = coordsList.map((c) => c.latitude);
  const lngs = coordsList.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.08);
  const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.08);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export default function LoadCard({
  origin,
  destination,
  payout,
  miles,
  rightLabel = 'Deadhead',
  rightValue,
  stops,
  originCoords,
  destCoords,
  onBook,
  showActions = true,
}) {
  const orderedStops = stops?.length ? getOrderedStops({ stops }) : null;
  const routeCoords = orderedStops?.length
    ? orderedStops.map((s) => s.coords)
    : getRoutePolyline({ stops, originCoords, destCoords });

  const region = getRegionFromCoords(routeCoords);

  return (
    <View style={styles.card}>
      {region && routeCoords.length >= 2 && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={region}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            userInterfaceStyle="dark"
            mapType="standard"
          >
            {(orderedStops ?? [
              { type: 'pickup', coords: routeCoords[0], sequence: 0 },
              { type: 'dropoff', coords: routeCoords[routeCoords.length - 1], sequence: 0 },
            ]).map((stop, index) => (
              <Marker
                key={`${stop.type}-${stop.sequence}-${index}`}
                coordinate={stop.coords || routeCoords[index]}
                pinColor={stop.type === 'dropoff' ? colors.primary : colors.onSurfaceVariant}
                title={stop.type === 'pickup' ? 'Pickup' : 'Drop-off'}
              />
            ))}
            <Polyline
              coordinates={routeCoords}
              strokeColor={colors.primary}
              strokeWidth={3}
              geodesic
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
    overflow: 'hidden',
  },
  mapContainer: {
    height: 120,
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
