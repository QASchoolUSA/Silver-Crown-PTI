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
exports.geocodeAddress = exports.getRouteWeather = exports.seedDemoData = exports.redeemInviteCode = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const nws_1 = require("./nws");
const geocode_1 = require("./geocode");
admin.initializeApp();
const db = admin.firestore();
(0, v2_1.setGlobalOptions)({ maxInstances: 10 });
exports.redeemInviteCode = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to redeem invite code.');
    }
    const { code, displayName } = request.data;
    if (!code || !displayName) {
        throw new https_1.HttpsError('invalid-argument', 'Code and displayName are required.');
    }
    const uid = request.auth.uid;
    const normalizedCode = code.trim().toUpperCase();
    const companiesSnap = await db.collectionGroup('inviteCodes')
        .where('code', '==', normalizedCode)
        .limit(1)
        .get();
    if (companiesSnap.empty) {
        throw new https_1.HttpsError('not-found', 'Invalid invite code.');
    }
    const inviteDoc = companiesSnap.docs[0];
    const inviteData = inviteDoc.data();
    const companyId = inviteData.companyId;
    if (new Date(inviteData.expiresAt) < new Date()) {
        throw new https_1.HttpsError('failed-precondition', 'Invite code has expired.');
    }
    if (inviteData.usedCount >= inviteData.maxUses) {
        throw new https_1.HttpsError('failed-precondition', 'Invite code has already been used.');
    }
    const userRef = db.collection('users').doc(uid);
    const existingUser = await userRef.get();
    if (existingUser.exists) {
        throw new https_1.HttpsError('already-exists', 'User profile already exists.');
    }
    await db.runTransaction(async (transaction) => {
        const freshInvite = await transaction.get(inviteDoc.ref);
        const data = freshInvite.data();
        if (data.usedCount >= data.maxUses) {
            throw new https_1.HttpsError('failed-precondition', 'Invite code has already been used.');
        }
        transaction.set(userRef, {
            email: request.auth.token.email || '',
            displayName,
            companyId,
            role: data.role,
            createdAt: new Date().toISOString(),
        });
        transaction.update(inviteDoc.ref, {
            usedCount: data.usedCount + 1,
        });
    });
    return { companyId, role: inviteData.role };
});
exports.seedDemoData = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const companyId = 'silver-crown-global';
    const companyRef = db.collection('companies').doc(companyId);
    await companyRef.set({
        name: 'Silver Crown Global',
        createdAt: new Date().toISOString(),
    }, { merge: true });
    const adminCode = 'ADMIN001';
    await companyRef.collection('inviteCodes').doc('admin-seed').set({
        code: adminCode,
        companyId,
        role: 'admin',
        createdBy: 'system',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        usedCount: 0,
        maxUses: 10,
        createdAt: new Date().toISOString(),
    });
    const driverCode = 'DRIVER01';
    await companyRef.collection('inviteCodes').doc('driver-seed').set({
        code: driverCode,
        companyId,
        role: 'driver',
        createdBy: 'system',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        usedCount: 0,
        maxUses: 100,
        createdAt: new Date().toISOString(),
    });
    return { companyId, adminCode, driverCode };
});
exports.getRouteWeather = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to fetch weather.');
    }
    const { originCoords, destCoords, originLabel, destLabel } = request.data;
    if (!originCoords || !destCoords) {
        throw new https_1.HttpsError('invalid-argument', 'originCoords and destCoords are required.');
    }
    if (!(0, nws_1.isValidCoords)(originCoords) || !(0, nws_1.isValidCoords)(destCoords)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid coordinates.');
    }
    return (0, nws_1.fetchRouteWeatherForFunction)(originLabel !== null && originLabel !== void 0 ? originLabel : 'Origin', originCoords, destLabel !== null && destLabel !== void 0 ? destLabel : 'Destination', destCoords);
});
async function requireAdmin(uid) {
    var _a;
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists || ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin access required.');
    }
}
exports.geocodeAddress = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to geocode addresses.');
    }
    await requireAdmin(request.auth.uid);
    const { query } = request.data;
    if (!query || typeof query !== 'string' || query.trim().length < 3) {
        throw new https_1.HttpsError('invalid-argument', 'Query must be at least 3 characters.');
    }
    try {
        const results = await (0, geocode_1.geocodeSearch)(query);
        return { results };
    }
    catch (error) {
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Geocoding failed.');
    }
});
//# sourceMappingURL=index.js.map