import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, CloudRain, Sun } from 'lucide-react';
import { getRouteWeather } from '@silver-crown/shared';
import type { Coords, LocationWeather, RouteWeather, WeatherAlert } from '@silver-crown/shared';

interface RouteWeatherPanelProps {
  originLabel: string;
  destinationLabel: string;
  originCoords?: Coords;
  destCoords?: Coords;
}

function forecastIcon(forecast: string) {
  const lower = forecast.toLowerCase();
  if (lower.includes('rain') || lower.includes('storm') || lower.includes('shower')) {
    return CloudRain;
  }
  if (lower.includes('cloud') || lower.includes('overcast')) return Cloud;
  if (lower.includes('sunny') || lower.includes('clear')) return Sun;
  return Cloud;
}

function WeatherSkeletonCard() {
  return (
    <div className="bg-surface-container border border-outline-variant rounded-lg p-5 animate-pulse">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="h-5 w-28 bg-surface-container-high rounded" />
        <div className="h-5 w-14 bg-surface-container-high rounded" />
      </div>
      <div className="h-16 bg-surface-container-high rounded-lg mb-4" />
      <div className="flex items-center gap-3 border-t border-outline-variant pt-3">
        <div className="h-5 w-5 bg-surface-container-high rounded shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-20 bg-surface-container-high rounded" />
          <div className="h-3 w-36 bg-surface-container-high rounded" />
        </div>
        <div className="h-4 w-10 bg-surface-container-high rounded" />
      </div>
    </div>
  );
}

function AlertBlock({ alert }: { alert: WeatherAlert }) {
  const description = alert.description?.trim();
  return (
    <div className="bg-error-container/25 border border-error/40 rounded-lg p-3.5">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        {alert.severity ? (
          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-error/20 text-error">
            {alert.severity}
          </span>
        ) : null}
        <p className="text-error font-bold text-sm">{alert.event}</p>
      </div>
      {alert.headline ? (
        <p className="text-on-surface text-sm leading-snug">{alert.headline}</p>
      ) : null}
      {description ? (
        <p className="text-on-surface-variant text-xs mt-2 line-clamp-2 leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function LocationWeatherCard({ weather }: { weather: LocationWeather }) {
  if (!weather.available) {
    return (
      <div className="bg-surface-container border border-outline-variant rounded-lg p-5">
        <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-wide uppercase mb-2">
          {weather.label}
        </h3>
        <p className="text-on-surface-variant text-sm">Weather data not available for this location.</p>
      </div>
    );
  }

  const hasAlerts = weather.alerts.length > 0;
  const showCaution = weather.hasAdverseConditions && !hasAlerts;
  const period = weather.periods[0];
  const Icon = period ? forecastIcon(period.shortForecast) : Cloud;

  return (
    <div
      className={`bg-surface-container border rounded-lg p-5 ${
        hasAlerts ? 'border-error/40' : 'border-outline-variant'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-wide uppercase">
          {weather.label}
        </h3>
        {hasAlerts ? (
          <span className="shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-error-container/40 text-error">
            Alert
          </span>
        ) : showCaution ? (
          <span className="shrink-0 px-2 py-1 text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
            Caution
          </span>
        ) : null}
      </div>

      {hasAlerts && (
        <div className="space-y-2 mb-4">
          {weather.alerts.map((alert) => (
            <AlertBlock key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {period && (
        <div className="flex items-center gap-3 border-t border-outline-variant pt-3">
          <Icon size={20} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{period.name}</p>
            <p className="text-on-surface-variant text-xs truncate">{period.shortForecast}</p>
          </div>
          <p className="font-bold text-sm shrink-0">
            {period.temperature}°{period.temperatureUnit}
          </p>
        </div>
      )}
    </div>
  );
}

export default function RouteWeatherPanel({
  originLabel,
  destinationLabel,
  originCoords,
  destCoords,
}: RouteWeatherPanelProps) {
  const [weather, setWeather] = useState<RouteWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!originCoords || !destCoords) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    getRouteWeather(originCoords, destCoords, originLabel, destinationLabel)
      .then(setWeather)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [originCoords, destCoords, originLabel, destinationLabel]);

  if (!originCoords || !destCoords) return null;

  const routeHasAdverse =
    weather?.origin.hasAdverseConditions || weather?.destination.hasAdverseConditions;
  const routeHasAlerts =
    (weather?.origin.alerts.length ?? 0) > 0 || (weather?.destination.alerts.length ?? 0) > 0;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">
        Route Weather
      </h2>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WeatherSkeletonCard />
          <WeatherSkeletonCard />
        </div>
      )}

      {error && !loading && (
        <p className="text-on-surface-variant text-sm">Unable to load weather forecast.</p>
      )}

      {!loading && !error && weather && (
        <>
          {routeHasAdverse && (
            <div
              className={`flex items-start gap-3 rounded-lg p-4 mb-4 ${
                routeHasAlerts
                  ? 'bg-error-container/25 border border-error/40'
                  : 'bg-amber-500/10 border border-amber-500/30'
              }`}
            >
              <AlertTriangle
                size={22}
                className={routeHasAlerts ? 'text-error shrink-0 mt-0.5' : 'text-amber-300 shrink-0 mt-0.5'}
              />
              <div>
                <p className={`font-bold text-sm ${routeHasAlerts ? 'text-error' : 'text-amber-300'}`}>
                  {routeHasAlerts
                    ? 'Active weather alerts on this route'
                    : 'Adverse conditions forecasted'}
                </p>
                <p className="text-on-surface-variant text-xs mt-1">
                  {routeHasAlerts
                    ? 'Review warnings below before dispatch.'
                    : 'Check origin and destination conditions before dispatch.'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationWeatherCard weather={weather.origin} />
            <LocationWeatherCard weather={weather.destination} />
          </div>
        </>
      )}
    </div>
  );
}
