"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRouteMiles = void 0;
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const geoapifyApiKey = (0, params_1.defineSecret)('GEOAPIFY_API_KEY');
const METERS_PER_MILE = 1609.344;
exports.calculateRouteMiles = (0, https_1.onCall)({ secrets: [geoapifyApiKey], timeoutSeconds: 60 }, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to calculate route miles.');
    }
    const userSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
    if (!userSnap.exists || ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access is required.');
    }
    const { stops, mode = 'truck' } = request.data;
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 25) {
        throw new https_1.HttpsError('invalid-argument', 'Provide between 2 and 25 ordered stops.');
    }
    const key = process.env.GEOAPIFY_API_KEY || geoapifyApiKey.value();
    if (!key) {
        throw new https_1.HttpsError('failed-precondition', 'Geoapify is not configured.');
    }
    const geocoded = [];
    for (const stop of stops) {
        if (!((_b = stop.address) === null || _b === void 0 ? void 0 : _b.trim())) {
            throw new https_1.HttpsError('invalid-argument', 'Every stop needs an address.');
        }
        const coords = isValidCoords(stop.coords)
            ? stop.coords
            : await geocodeAddress(stop.address, key);
        geocoded.push(Object.assign(Object.assign({}, stop), { coords }));
    }
    const waypointValue = geocoded
        .map((stop) => `${stop.coords.latitude},${stop.coords.longitude}`)
        .join('|');
    const routeUrl = new URL('https://api.geoapify.com/v1/routing');
    routeUrl.search = new URLSearchParams({
        waypoints: waypointValue,
        mode,
        units: 'imperial',
        type: 'balanced',
        format: 'geojson',
        apiKey: key,
    }).toString();
    const routeResponse = await fetch(routeUrl);
    if (!routeResponse.ok) {
        throw new https_1.HttpsError('unavailable', `Geoapify routing failed (${routeResponse.status}).`);
    }
    const routeJson = await routeResponse.json();
    const properties = (_d = (_c = routeJson.features) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.properties;
    if (!properties || !Number.isFinite(properties.distance)) {
        throw new https_1.HttpsError('not-found', 'No truck route was found for these stops.');
    }
    const units = ((_e = properties.distance_units) === null || _e === void 0 ? void 0 : _e.toLowerCase()) || '';
    const miles = units.includes('mile')
        ? properties.distance
        : properties.distance / METERS_PER_MILE;
    return {
        miles: Math.round(miles),
        milesExact: Number(miles.toFixed(1)),
        distanceUnits: 'miles',
        stops: geocoded,
    };
});
async function geocodeAddress(address, apiKey) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.search = new URLSearchParams({
        text: address,
        format: 'geojson',
        filter: 'countrycode:us',
        bias: 'countrycode:us',
        limit: '1',
        apiKey,
    }).toString();
    const response = await fetch(url);
    if (!response.ok) {
        throw new https_1.HttpsError('unavailable', `Geoapify geocoding failed (${response.status}).`);
    }
    const json = await response.json();
    const feature = (_a = json.features) === null || _a === void 0 ? void 0 : _a[0];
    const lon = (_c = (_b = feature === null || feature === void 0 ? void 0 : feature.properties) === null || _b === void 0 ? void 0 : _b.lon) !== null && _c !== void 0 ? _c : (_e = (_d = feature === null || feature === void 0 ? void 0 : feature.geometry) === null || _d === void 0 ? void 0 : _d.coordinates) === null || _e === void 0 ? void 0 : _e[0];
    const lat = (_g = (_f = feature === null || feature === void 0 ? void 0 : feature.properties) === null || _f === void 0 ? void 0 : _f.lat) !== null && _g !== void 0 ? _g : (_j = (_h = feature === null || feature === void 0 ? void 0 : feature.geometry) === null || _h === void 0 ? void 0 : _h.coordinates) === null || _j === void 0 ? void 0 : _j[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new https_1.HttpsError('not-found', `Could not geocode: ${address}`);
    }
    return { latitude: lat, longitude: lon };
}
function isValidCoords(coords) {
    return Boolean(coords
        && Number.isFinite(coords.latitude)
        && Number.isFinite(coords.longitude)
        && Math.abs(coords.latitude) <= 90
        && Math.abs(coords.longitude) <= 180
        && (coords.latitude !== 0 || coords.longitude !== 0));
}
//# sourceMappingURL=geoapify.js.map