"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCoords = isValidCoords;
exports.fetchRouteWeatherForFunction = fetchRouteWeatherForFunction;
const NWS_BASE = 'https://api.weather.gov';
const NWS_USER_AGENT = '(silver-crown-app, contact@silvercrown.com)';
const CACHE_TTL_MS = 15 * 60 * 1000;
const ADVERSE_KEYWORDS = [
    'thunderstorm', 'tornado', 'blizzard', ' ice ', 'snow', 'flood', 'hail',
    'heavy rain', 'freezing', 'wind advisory', 'hurricane', ' tropical ',
    'winter storm', 'dense fog',
];
const ADVERSE_SEVERITIES = ['Extreme', 'Severe', 'Moderate'];
const weatherCache = new Map();
function hasAdverseConditions(alerts, periods) {
    if (alerts.some((a) => ADVERSE_SEVERITIES.includes(a.severity)))
        return true;
    const text = periods.map((p) => p.shortForecast.toLowerCase()).join(' ');
    return ADVERSE_KEYWORDS.some((kw) => text.includes(kw));
}
function normalizeAlerts(features) {
    return features
        .map((feature) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const f = feature;
        const props = f.properties;
        if (!props)
            return null;
        return {
            id: (_b = (_a = props.id) !== null && _a !== void 0 ? _a : f.id) !== null && _b !== void 0 ? _b : '',
            event: (_c = props.event) !== null && _c !== void 0 ? _c : 'Alert',
            severity: (_d = props.severity) !== null && _d !== void 0 ? _d : 'Unknown',
            headline: (_f = (_e = props.headline) !== null && _e !== void 0 ? _e : props.event) !== null && _f !== void 0 ? _f : 'Weather Alert',
            description: (_g = props.description) !== null && _g !== void 0 ? _g : '',
            expires: (_h = props.expires) !== null && _h !== void 0 ? _h : '',
        };
    })
        .filter((a) => a !== null && a.id !== '');
}
function normalizePeriods(rawPeriods) {
    return rawPeriods.map((raw) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const p = raw;
        return {
            name: (_a = p.name) !== null && _a !== void 0 ? _a : '',
            startTime: (_b = p.startTime) !== null && _b !== void 0 ? _b : '',
            temperature: (_c = p.temperature) !== null && _c !== void 0 ? _c : 0,
            temperatureUnit: (_d = p.temperatureUnit) !== null && _d !== void 0 ? _d : 'F',
            windSpeed: (_e = p.windSpeed) !== null && _e !== void 0 ? _e : '',
            shortForecast: (_f = p.shortForecast) !== null && _f !== void 0 ? _f : '',
            isDaytime: (_g = p.isDaytime) !== null && _g !== void 0 ? _g : true,
        };
    });
}
function emptyLocationWeather(label) {
    return { label, periods: [], alerts: [], hasAdverseConditions: false, available: false };
}
function buildLocationWeather(label, periods, alerts) {
    return { label, periods, alerts, hasAdverseConditions: hasAdverseConditions(alerts, periods), available: true };
}
function cacheKey(coords) {
    return `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;
}
function isValidCoords(coords) {
    return (typeof coords.latitude === 'number' &&
        typeof coords.longitude === 'number' &&
        coords.latitude >= -90 &&
        coords.latitude <= 90 &&
        coords.longitude >= -180 &&
        coords.longitude <= 180);
}
async function fetchLocationWeather(label, coords) {
    var _a, _b, _c, _d;
    const key = cacheKey(coords);
    const cached = weatherCache.get(key);
    if (cached && cached.expires > Date.now()) {
        return Object.assign(Object.assign({}, cached.data), { label });
    }
    const headers = { 'User-Agent': NWS_USER_AGENT, Accept: 'application/geo+json' };
    try {
        const lat = coords.latitude.toFixed(4);
        const lon = coords.longitude.toFixed(4);
        const pointsRes = await fetch(`${NWS_BASE}/points/${lat},${lon}`, { headers });
        if (!pointsRes.ok)
            return emptyLocationWeather(label);
        const pointsData = (await pointsRes.json());
        const forecastUrl = (_a = pointsData.properties) === null || _a === void 0 ? void 0 : _a.forecast;
        let periods = [];
        if (forecastUrl) {
            const forecastRes = await fetch(forecastUrl, { headers });
            if (forecastRes.ok) {
                const forecastData = (await forecastRes.json());
                periods = normalizePeriods((_c = (_b = forecastData.properties) === null || _b === void 0 ? void 0 : _b.periods) !== null && _c !== void 0 ? _c : []).slice(0, 3);
            }
        }
        let alerts = [];
        const alertsRes = await fetch(`${NWS_BASE}/alerts/active?point=${lat},${lon}`, { headers });
        if (alertsRes.ok) {
            const alertsData = (await alertsRes.json());
            alerts = normalizeAlerts((_d = alertsData.features) !== null && _d !== void 0 ? _d : []);
        }
        const result = buildLocationWeather(label, periods, alerts);
        weatherCache.set(key, { data: result, expires: Date.now() + CACHE_TTL_MS });
        return result;
    }
    catch (_e) {
        return emptyLocationWeather(label);
    }
}
async function fetchRouteWeatherForFunction(originLabel, originCoords, destLabel, destCoords) {
    const [origin, destination] = await Promise.all([
        fetchLocationWeather(originLabel, originCoords),
        fetchLocationWeather(destLabel, destCoords),
    ]);
    return { origin, destination };
}
//# sourceMappingURL=nws.js.map