import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { getLoadById, getRouteWeather } from '@silver-crown/shared';
import LoadCard from '../components/LoadCard';
import { colors, typography } from '../theme';

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

  return (
    <View style={styles.weatherCard}>
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
        ) : (
          <View style={styles.badgeClear}>
            <Text style={styles.badgeClearText}>All Clear</Text>
          </View>
        )}
      </View>

      {weather.alerts.map((alert) => (
        <View key={alert.id} style={styles.alertBox}>
          <Text style={styles.alertEvent}>{alert.event}</Text>
          <Text style={styles.alertHeadline}>{alert.headline}</Text>
        </View>
      ))}

      {weather.periods.map((period) => (
        <View key={`${period.name}-${period.startTime}`} style={styles.periodRow}>
          <View style={styles.periodInfo}>
            <Text style={styles.periodName}>{period.name}</Text>
            <Text style={styles.periodForecast}>{period.shortForecast}</Text>
          </View>
          <View style={styles.periodTemp}>
            <Text style={styles.periodTempValue}>
              {period.temperature}°{period.temperatureUnit}
            </Text>
            {period.windSpeed ? (
              <Text style={styles.periodWind}>{period.windSpeed}</Text>
            ) : null}
          </View>
        </View>
      ))}
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
        rightLabel={rightLabel}
        rightValue={rightValue}
        originCoords={load.originCoords}
        destCoords={load.destCoords}
        showActions={false}
      />

      {load.assignedDriverName && (
        <Text style={styles.driverLabel}>Driver: {load.assignedDriverName}</Text>
      )}

      <Text style={styles.sectionTitle}>Route Weather</Text>

      {weatherLoading && !weather && (
        <ActivityIndicator size="small" color={colors.primary} style={styles.weatherSpinner} />
      )}

      {routeHasAdverse && weather && (
        <View style={[styles.banner, routeHasAlerts ? styles.bannerAlert : styles.bannerCaution]}>
          <AlertTriangle size={18} color={routeHasAlerts ? colors.error : '#fbbf24'} />
          <Text style={[styles.bannerText, routeHasAlerts ? styles.bannerTextAlert : styles.bannerTextCaution]}>
            {routeHasAlerts
              ? 'Active weather alerts on this route'
              : 'Adverse conditions forecasted'}
          </Text>
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
  },
  weatherSpinner: { marginBottom: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  bannerAlert: { backgroundColor: 'rgba(147, 0, 10, 0.2)', borderColor: colors.error },
  bannerCaution: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: '#fbbf24' },
  bannerText: { flex: 1, fontFamily: typography.montserratBold, fontSize: 13 },
  bannerTextAlert: { color: colors.error },
  bannerTextCaution: { color: '#fbbf24' },
  weatherStack: { gap: 12 },
  weatherCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
  },
  weatherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  weatherLocation: { color: colors.onSurface, fontFamily: typography.bebas, fontSize: 22, flex: 1, textTransform: 'uppercase' },
  badgeAlert: { backgroundColor: 'rgba(147, 0, 10, 0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeAlertText: { color: colors.error, fontFamily: typography.montserratBold, fontSize: 10, textTransform: 'uppercase' },
  badgeCaution: { backgroundColor: 'rgba(251, 191, 36, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeCautionText: { color: '#fbbf24', fontFamily: typography.montserratBold, fontSize: 10, textTransform: 'uppercase' },
  badgeClear: { backgroundColor: 'rgba(137, 206, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeClearText: { color: colors.primary, fontFamily: typography.montserratBold, fontSize: 10, textTransform: 'uppercase' },
  alertBox: { backgroundColor: 'rgba(147, 0, 10, 0.15)', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.error },
  alertEvent: { color: colors.error, fontFamily: typography.montserratBold, fontSize: 13 },
  alertHeadline: { color: colors.onSurface, fontFamily: typography.montserrat, fontSize: 12, marginTop: 4 },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  periodInfo: { flex: 1, paddingRight: 12 },
  periodName: { color: colors.onSurface, fontFamily: typography.montserratBold, fontSize: 14 },
  periodForecast: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 12, marginTop: 2 },
  periodTemp: { alignItems: 'flex-end' },
  periodTempValue: { color: colors.onSurface, fontFamily: typography.montserratBold, fontSize: 14 },
  periodWind: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 10, marginTop: 2 },
  weatherUnavailable: { color: colors.onSurfaceVariant, fontFamily: typography.montserrat, fontSize: 14 },
});
