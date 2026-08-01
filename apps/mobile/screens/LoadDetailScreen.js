import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { getLoadById, getRouteWeather, getOrderedStops, buildGoogleMapsDirectionsUrl, buildAppleMapsDirectionsUrl } from '@silver-crown/shared';
import LoadCard from '../components/LoadCard';
import { colors, typography } from '../theme';

function WeatherSkeletonCard() {
  return (
    <View style={styles.weatherCard}>
      <View style={styles.skeletonTitleRow}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonBadge} />
      </View>
      <View style={styles.skeletonAlert} />
      <View style={styles.skeletonPeriodRow}>
        <View style={styles.skeletonPeriodText} />
        <View style={styles.skeletonTemp} />
      </View>
    </View>
  );
}

function WeatherLocationCard({ weather }) {
  if (!weather.available) {
    return (
      <View style={styles.weatherCard}>
        <Text style={styles.weatherLocation}>{weather.label}</Text>
        <Text style={styles.weatherUnavailable}>Weather data not available for this location.</Text>
      </View>
    );
  }

  const hasAlerts = weather.alerts.length > 0;
  const showCaution = weather.hasAdverseConditions && !hasAlerts;
  const period = weather.periods?.[0];

  return (
    <View style={[styles.weatherCard, hasAlerts && styles.weatherCardAlert]}>
      <View style={styles.weatherHeader}>
        <Text style={styles.weatherLocation}>{weather.label}</Text>
        {hasAlerts ? (
          <View style={styles.badgeAlert}>
            <Text style={styles.badgeAlertText}>Alert</Text>
          </View>
        ) : showCaution ? (
          <View style={styles.badgeCaution}>
            <Text style={styles.badgeCautionText}>Caution</Text>
          </View>
        ) : null}
      </View>

      {hasAlerts
        ? weather.alerts.map((alert) => (
            <View key={alert.id} style={styles.alertBox}>
              <View style={styles.alertMeta}>
                {alert.severity ? (
                  <Text style={styles.alertSeverity}>{alert.severity}</Text>
                ) : null}
                <Text style={styles.alertEvent}>{alert.event}</Text>
              </View>
              {alert.headline ? <Text style={styles.alertHeadline}>{alert.headline}</Text> : null}
              {alert.description ? (
                <Text style={styles.alertDescription} numberOfLines={2}>
                  {alert.description}
                </Text>
              ) : null}
            </View>
          ))
        : null}

      {period ? (
        <View style={styles.periodRow}>
          <View style={styles.periodInfo}>
            <Text style={styles.periodName}>{period.name}</Text>
            <Text style={styles.periodForecast} numberOfLines={1}>
              {period.shortForecast}
            </Text>
          </View>
          <Text style={styles.periodTempValue}>
            {period.temperature}°{period.temperatureUnit}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function LoadDetailScreen({ route }) {
  const { loadId } = route.params;
  const [load, setLoad] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWeather = useCallback(async (loadData) => {
    if (!loadData?.originCoords || !loadData?.destCoords) return;
    setWeatherLoading(true);
    try {
      const data = await getRouteWeather(
        loadData.originCoords,
        loadData.destCoords,
        loadData.origin,
        loadData.destination
      );
      setWeather(data);
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const fetchLoad = useCallback(async () => {
    const data = await getLoadById(loadId);
    setLoad(data);
    if (data) await fetchWeather(data);
  }, [loadId, fetchWeather]);

  useEffect(() => {
    setLoading(true);
    fetchLoad().finally(() => setLoading(false));
  }, [fetchLoad]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLoad();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!load) {
    return (
      <View style={styles.loading}>
        <Text style={styles.emptyText}>Load not found.</Text>
      </View>
    );
  }

  const routeHasAdverse =
    weather?.origin?.hasAdverseConditions || weather?.destination?.hasAdverseConditions;
  const routeHasAlerts =
    (weather?.origin?.alerts?.length ?? 0) > 0 || (weather?.destination?.alerts?.length ?? 0) > 0;

  const rightLabel = load.status === 'delivered' ? 'Delivery' : 'Deadhead';
  const rightValue =
    load.status === 'delivered'
      ? load.deliveryDate
        ? new Date(load.deliveryDate).toLocaleDateString()
        : '—'
      : `${load.deadhead || '0'} mi`;

  const orderedStops = getOrderedStops(load);
  const googleMapsUrl = buildGoogleMapsDirectionsUrl(orderedStops);
  const appleMapsUrl = buildAppleMapsDirectionsUrl(orderedStops);

  const openMaps = async (url, label) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unavailable', `${label} is not available on this device.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', `Could not open ${label}.`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <LoadCard
        origin={load.origin}
        destination={load.destination}
        payout={load.payout}
        miles={load.miles}
        loadRef={load.loadRef}
        broker={load.broker}
        rightLabel={rightLabel}
        rightValue={rightValue}
        stops={orderedStops}
        originCoords={load.originCoords}
        destCoords={load.destCoords}
        showActions={false}
      />

      {(load.lineHaul || load.accessorials || load.dispatchDate || load.pickupDate) && (
        <View style={styles.freightDetails}>
          {load.loadRef && <Text style={styles.detailRow}>Load: {load.loadRef}</Text>}
          {load.broker && <Text style={styles.detailRow}>Broker: {load.broker}</Text>}
          {load.lineHaul && <Text style={styles.detailRow}>Line haul: ${load.lineHaul}</Text>}
          {load.accessorials && <Text style={styles.detailRow}>Accessorials: ${load.accessorials}</Text>}
          {load.dispatchDate && <Text style={styles.detailRow}>Dispatched: {load.dispatchDate}</Text>}
          {load.pickupDate && <Text style={styles.detailRow}>Pickup: {load.pickupDate}</Text>}
        </View>
      )}

      <Text style={styles.sectionTitle}>Stops</Text>
      <View style={styles.stopsList}>
        {orderedStops.map((stop, index) => (
          <View key={`${stop.type}-${stop.sequence}-${index}`} style={styles.stopRow}>
            <View style={[styles.stopDot, stop.type === 'dropoff' && styles.stopDotDropoff]} />
            <View style={styles.stopInfo}>
              <Text style={styles.stopType}>
                {stop.type === 'pickup' ? 'Pickup' : 'Drop-off'} {stop.sequence + 1}
              </Text>
              <Text style={styles.stopAddress}>{stop.address}</Text>
            </View>
          </View>
        ))}
      </View>

      {(googleMapsUrl || appleMapsUrl) && (
        <View style={styles.mapsActions}>
          {googleMapsUrl && (
            <TouchableOpacity style={styles.mapsButton} onPress={() => openMaps(googleMapsUrl, 'Google Maps')}>
              <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          )}
          {appleMapsUrl && (
            <TouchableOpacity style={[styles.mapsButton, styles.mapsButtonSecondary]} onPress={() => openMaps(appleMapsUrl, 'Apple Maps')}>
              <Text style={styles.mapsButtonTextSecondary}>Open in Apple Maps</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {load.assignedDriverName && (
        <Text style={styles.driverLabel}>Driver: {load.assignedDriverName}</Text>
      )}

      <Text style={styles.sectionTitle}>Route Weather</Text>

      {weatherLoading && !weather && (
        <View style={styles.weatherStack}>
          <WeatherSkeletonCard />
          <WeatherSkeletonCard />
        </View>
      )}

      {routeHasAdverse && weather && (
        <View style={[styles.banner, routeHasAlerts ? styles.bannerAlert : styles.bannerCaution]}>
          <AlertTriangle size={18} color={routeHasAlerts ? colors.error : '#fbbf24'} />
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerText, routeHasAlerts ? styles.bannerTextAlert : styles.bannerTextCaution]}>
              {routeHasAlerts
                ? 'Active weather alerts on this route'
                : 'Adverse conditions forecasted'}
            </Text>
            <Text style={styles.bannerHint}>
              {routeHasAlerts
                ? 'Review warnings below before dispatch.'
                : 'Check origin and destination conditions before dispatch.'}
            </Text>
          </View>
        </View>
      )}

      {weather && (
        <View style={styles.weatherStack}>
          <WeatherLocationCard weather={weather.origin} />
          <WeatherLocationCard weather={weather.destination} />
        </View>
      )}

      {!weatherLoading && !weather && load.originCoords && load.destCoords && (
        <Text style={styles.weatherUnavailable}>Unable to load weather forecast.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 16 },
  driverLabel: {
    color: colors.primary,
    fontFamily: typography.montserratSemiBold,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserratBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  stopsList: {
    gap: 10,
    marginBottom: 16,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 12,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.onSurfaceVariant,
    marginTop: 4,
  },
  stopDotDropoff: {
    backgroundColor: colors.primary,
  },
  stopInfo: {
    flex: 1,
  },
  stopType: {
    color: colors.onSurface,
    fontFamily: typography.montserratBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopAddress: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 13,
    marginTop: 4,
  },
  mapsActions: {
    gap: 10,
    marginBottom: 20,
  },
  mapsButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  mapsButtonSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  mapsButtonTextSecondary: {
    color: colors.onSurface,
    fontFamily: typography.montserratBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapsButtonText: {
    color: colors.onPrimary,
    fontFamily: typography.montserratBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  bannerAlert: { backgroundColor: 'rgba(147, 0, 10, 0.25)', borderColor: colors.error },
  bannerCaution: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: '#fbbf24' },
  bannerCopy: { flex: 1 },
  bannerText: { fontFamily: typography.montserratBold, fontSize: 13 },
  bannerTextAlert: { color: colors.error },
  bannerTextCaution: { color: '#fbbf24' },
  bannerHint: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 11,
    marginTop: 4,
  },
  weatherStack: { gap: 12 },
  weatherCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
  },
  weatherCardAlert: {
    borderColor: colors.error,
  },
  weatherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  weatherLocation: { color: colors.onSurface, fontFamily: typography.bebas, fontSize: 22, flex: 1, textTransform: 'uppercase' },
  badgeAlert: { backgroundColor: 'rgba(147, 0, 10, 0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeAlertText: { color: colors.error, fontFamily: typography.montserratBold, fontSize: 10, textTransform: 'uppercase' },
  badgeCaution: { backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeCautionText: { color: '#fbbf24', fontFamily: typography.montserratBold, fontSize: 10, textTransform: 'uppercase' },
  alertBox: {
    backgroundColor: 'rgba(147, 0, 10, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.error,
  },
  alertMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertSeverity: {
    color: colors.error,
    fontFamily: typography.montserratBold,
    fontSize: 10,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(147, 0, 10, 0.25)',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  alertEvent: { color: colors.error, fontFamily: typography.montserratBold, fontSize: 14 },
  alertHeadline: { color: colors.onSurface, fontFamily: typography.montserrat, fontSize: 13, marginTop: 2 },
  alertDescription: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  periodInfo: { flex: 1, paddingRight: 12 },
  periodName: { color: colors.onSurface, fontFamily: typography.montserratBold, fontSize: 14 },
  periodForecast: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 12, marginTop: 2 },
  periodTempValue: { color: colors.onSurface, fontFamily: typography.montserratBold, fontSize: 14 },
  skeletonTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  skeletonTitle: { width: 110, height: 18, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh },
  skeletonBadge: { width: 48, height: 18, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh },
  skeletonAlert: { height: 64, borderRadius: 8, backgroundColor: colors.surfaceContainerHigh, marginBottom: 12 },
  skeletonPeriodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  skeletonPeriodText: { width: 140, height: 14, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh },
  skeletonTemp: { width: 36, height: 14, borderRadius: 4, backgroundColor: colors.surfaceContainerHigh },
  weatherUnavailable: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 14 },
  freightDetails: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  detailRow: {
    color: colors.onSurfaceVariant,
    fontFamily: typography.montserrat,
    fontSize: 13,
  },
});
