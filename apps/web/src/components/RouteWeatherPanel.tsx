import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, CloudRain, Sun, Wind } from 'lucide-react';
import { getRouteWeather } from '@silver-crown/shared';
import type { Coords, LocationWeather, RouteWeather } from '@silver-crown/shared';

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
  if (lower.includes('wind')) return Wind;
  if (lower.includes('cloud') || lower.includes('overcast')) return Cloud;
  if (lower.includes('sunny') || lower.includes('clear')) return Sun;
  return Cloud;
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

  return (
    <div className="bg-surface-container border border-outline-variant rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-[family-name:var(--font-bebas)] text-xl tracking-wide uppercase">
          {weather.label}
        </h3>
        {hasAlerts ? (
          <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-error-container/40 text-error">
            Alert
          </span>
        ) : showCaution ? (
          <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
            Caution
          </span>
        ) : (
          <span className="shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/20 text-primary">
            All Clear
          </span>
        )}
      </div>

      {hasAlerts && (
        <div className="space-y-2 mb-4">
          {weather.alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-error-container/20 border border-error/30 rounded-lg p-3"
            >
              <p className="text-error font-bold text-sm">{alert.event}</p>
              <p className="text-on-surface text-xs mt-1">{alert.headline}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {weather.periods.map((period) => {
          const Icon = forecastIcon(period.shortForecast);
          return (
            <div
              key={`${period.name}-${period.startTime}`}
              className="flex items-center gap-3 border-t border-outline-variant pt-3 first:border-t-0 first:pt-0"
            >
              <Icon size={20} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{period.name}</p>
                <p className="text-on-surface-variant text-xs truncate">{period.shortForecast}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm">
                  {period.temperature}°{period.temperatureUnit}
                </p>
                {period.windSpeed && (
                  <p className="text-on-surface-variant text-[10px]">{period.windSpeed}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-surface-container border border-outline-variant rounded-lg p-5 h-48 animate-pulse"
            />
          ))}
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
                  ? 'bg-error-container/20 border border-error/30'
                  : 'bg-amber-500/10 border border-amber-500/30'
              }`}
            >
              <AlertTriangle
                size={20}
                className={routeHasAlerts ? 'text-error shrink-0 mt-0.5' : 'text-amber-300 shrink-0 mt-0.5'}
              />
              <div>
                <p className={`font-bold text-sm ${routeHasAlerts ? 'text-error' : 'text-amber-300'}`}>
                  {routeHasAlerts ? 'Active weather alerts on this route' : 'Adverse conditions forecasted'}
                </p>
                <p className="text-on-surface-variant text-xs mt-1">
                  Review origin and destination forecasts before dispatch.
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
