"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhotonAddress = formatPhotonAddress;
exports.mapPhotonFeatures = mapPhotonFeatures;
exports.searchPhoton = searchPhoton;
exports.searchNominatim = searchNominatim;
exports.geocodeSearch = geocodeSearch;
const PHOTON_BASE = 'https://photon.komoot.io/api/';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SilverCrown/1.0 (load geocoding)';
const THROTTLE_MS = 300;
const CACHE_MAX = 50;
/** Continental US bbox bias (minLon, minLat, maxLon, maxLat) */
const US_BBOX = '-125.0,24.0,-66.0,49.5';
let lastRequestAt = 0;
const cache = new Map();
function formatPhotonAddress(props) {
    const streetLine = [props.housenumber, props.street].filter(Boolean).join(' ');
    const locality = [props.city, props.state, props.postcode].filter(Boolean).join(', ');
    const parts = [streetLine || props.name, locality, props.country].filter(Boolean);
    return parts.join(', ');
}
function mapPhotonFeatures(features) {
    const results = [];
    for (const feature of features) {
        const [lon, lat] = feature.geometry.coordinates;
        const address = formatPhotonAddress(feature.properties);
        if (!address || Number.isNaN(lat) || Number.isNaN(lon))
            continue;
        const { osm_id, osm_type } = feature.properties;
        results.push({
            address,
            coords: { latitude: lat, longitude: lon },
            placeId: osm_id && osm_type ? `${osm_type}:${osm_id}` : undefined,
        });
    }
    return results;
}
async function throttle() {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < THROTTLE_MS) {
        await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
    }
    lastRequestAt = Date.now();
}
function cacheGet(key) {
    const normalized = key.trim().toLowerCase();
    const hit = cache.get(normalized);
    if (hit) {
        cache.delete(normalized);
        cache.set(normalized, hit);
    }
    return hit;
}
function cacheSet(key, results) {
    const normalized = key.trim().toLowerCase();
    if (cache.has(normalized))
        cache.delete(normalized);
    cache.set(normalized, results);
    if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest)
            cache.delete(oldest);
    }
}
async function searchPhoton(query) {
    var _a;
    const trimmed = query.trim();
    if (trimmed.length < 3)
        return [];
    await throttle();
    const params = new URLSearchParams({
        q: trimmed,
        limit: '5',
        lang: 'en',
        bbox: US_BBOX,
    });
    const response = await fetch(`${PHOTON_BASE}?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Photon geocoding failed (${response.status})`);
    }
    const data = (await response.json());
    return mapPhotonFeatures((_a = data.features) !== null && _a !== void 0 ? _a : []);
}
async function searchNominatim(query) {
    const trimmed = query.trim();
    if (trimmed.length < 3)
        return [];
    await throttle();
    const params = new URLSearchParams({
        q: trimmed,
        format: 'json',
        limit: '5',
        addressdetails: '1',
        countrycodes: 'us',
    });
    const response = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
        throw new Error(`Nominatim geocoding failed (${response.status})`);
    }
    const data = (await response.json());
    return data.map((item) => ({
        address: item.display_name,
        coords: {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
        },
        placeId: String(item.place_id),
    }));
}
async function geocodeSearch(query) {
    const trimmed = query.trim();
    if (trimmed.length < 3)
        return [];
    const cached = cacheGet(trimmed);
    if (cached)
        return cached;
    let results = [];
    try {
        results = await searchPhoton(trimmed);
    }
    catch (_a) {
        results = [];
    }
    if (results.length === 0) {
        try {
            results = await searchNominatim(trimmed);
        }
        catch (_b) {
            results = [];
        }
    }
    cacheSet(trimmed, results);
    return results;
}
//# sourceMappingURL=geocode.js.map