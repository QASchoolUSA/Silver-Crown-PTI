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
exports.seedDemoData = exports.redeemInviteCode = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
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
//# sourceMappingURL=index.js.map