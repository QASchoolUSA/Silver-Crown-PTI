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
exports.extractDocumentData = void 0;
/**
 * Upgrade extractDocument Cloud Function with VLM-quality rate-con prompts,
 * multi-page image parts, financial reconcile, and Gemini model fallbacks.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
const CORPORATE_KEYWORDS = [
    'remit to',
    'corporate hq',
    'billing office',
    'p.o. box',
    'po box',
    'factoring',
];
exports.extractDocumentData = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to extract document data.');
    }
    const { documentId, fileUrl, fileName, fileType, base64Data, base64Pages, apiKey: requestApiKey, } = request.data;
    if (!documentId) {
        throw new https_1.HttpsError('invalid-argument', 'documentId is required.');
    }
    const db = admin.firestore();
    const docRef = db.collection('documents').doc(documentId);
    const [userSnap, documentSnap] = await Promise.all([
        db.collection('users').doc(request.auth.uid).get(),
        docRef.get(),
    ]);
    const userData = userSnap.data();
    const documentData = documentSnap.data();
    if (!userSnap.exists
        || (userData === null || userData === void 0 ? void 0 : userData.role) !== 'admin'
        || !documentSnap.exists
        || (documentData === null || documentData === void 0 ? void 0 : documentData.companyId) !== userData.companyId) {
        throw new https_1.HttpsError('permission-denied', 'Admin access to this document is required.');
    }
    // Secret is injected as GEMINI_API_KEY when secrets: [geminiApiKey] is set.
    let apiKey = requestApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
        try {
            apiKey = geminiApiKey.value();
        }
        catch (_a) {
            apiKey = undefined;
        }
    }
    try {
        let extracted;
        if (apiKey) {
            extracted = await callGeminiVisionApi(apiKey, fileUrl, base64Data, base64Pages, fileType, fileName);
        }
        else {
            extracted = generateDevMockExtraction(fileName);
        }
        await docRef.update({
            extractedData: stripUndefined(extracted),
            docType: extracted.documentType || 'other',
            status: 'processed',
            updatedAt: new Date().toISOString(),
        });
        return { success: true, extractedData: extracted };
    }
    catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Extraction failed';
        await docRef.update({
            status: 'error',
            errorMessage: errMessage,
            updatedAt: new Date().toISOString(),
        });
        throw new https_1.HttpsError('internal', `Failed to process document: ${errMessage}`);
    }
});
function stripUndefined(value) {
    if (Array.isArray(value))
        return value.map(stripUndefined);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([, nested]) => nested !== undefined)
            .map(([key, nested]) => [key, stripUndefined(nested)]));
    }
    return value;
}
function buildVisionPrompt() {
    return `You are a freight-document extraction engine used by experienced truck dispatchers. Transcribe the document and return factual data only. Never infer printed miles, money, addresses, or stop order.

Perform a 2-stage analysis of this document image (or multi-page images):
STAGE 1: Transcribe ALL text on the page(s) into "rawText" (including headers, table cells, stamps, seal numbers, and handwritten notes).
STAGE 2: Extract structured JSON matching this exact schema:
{
  "documentType": "bill_of_lading" | "rate_confirmation" | "proof_of_delivery" | "receipt" | "other",
  "bolNumber": string or null,
  "rateConfirmationNumber": string or null,
  "carrierName": string or null,
  "shipperName": string or null,
  "consigneeName": string or null,
  "originAddress": string or null,
  "destinationAddress": string or null,
  "pickupDate": string or null,
  "deliveryDate": string or null,
  "totalRate": string or null,
  "weight": string or null,
  "handwrittenNotes": string or null,
  "rawText": string,
  "rateConDraft": {
    "loadRef": string or null,
    "broker": string or null,
    "payout": string or null,
    "lineHaul": string or null,
    "accessorials": string or null,
    "accessorialDetail": string or null,
    "miles": string or null,
    "type": "Dry Van" | "Reefer" | "Flatbed" | null,
    "pickupDate": "YYYY-MM-DD" or null,
    "deliveryDate": "YYYY-MM-DD" or null,
    "dispatchDate": "YYYY-MM-DD" or null,
    "stops": [
      {
        "type": "pickup" | "dropoff",
        "address": "facility name, street, city, state ZIP (full printed operational address)",
        "sequence": number starting at 0 within that stop type
      }
    ],
    "confidence": number from 0 to 1,
    "warnings": string[]
  } or null
}

Classification Rules:
1. "bill_of_lading": Contains terms like "Bill of Lading", "BOL", "Straight Bill of Lading", Shipper, Consignee, commodity list, piece counts, trailer/seal #.
2. "rate_confirmation": Contains "Rate Confirmation", "Confirmation #", "Broker", "Load Agreement", carrier payout/rate ($ amount), linehaul, origin/destination.
3. "proof_of_delivery": Title or primary purpose is Proof of Delivery / delivery receipt with receiver signature. Mentions of "send POD with invoice" on a rate confirmation do NOT make it a POD.
4. "receipt": Weight tickets (CAT Scale), Fuel receipts, Lumper receipts, Toll receipts, Maintenance invoices.

Rate Confirmation / VLM Field Rules:
- Priority 1 / Carrier Load Tender / Line Haul / Flat Rate documents are rate_confirmation even when they mention PODs for invoicing.
- Ignore remit-to, corporate office, billing office, factoring, and P.O. Box addresses. Only extract actual pickup (shipper) and dropoff (consignee) facilities.
- For each stop, prefer facility_name + street + city/state/ZIP combined into one "address" string.
- Include every pickup and delivery in the printed operational order. Preserve multiple pickups and multiple dropoffs. Do not collapse them into one origin and destination.
- "payout" is the total carrier gross/flat rate. "lineHaul" excludes fuel surcharge and accessorials. "accessorials" is their total; explain components (FSC, detention, lumper, tarp, stop-off, etc.) in "accessorialDetail".
- "loadRef" is the broker load/order/confirmation number used to identify the load.
- "broker" is the broker/logistics company issuing the confirmation, not the carrier.
- Set "miles" only when mileage is explicitly printed. Never calculate or estimate it.
- A CamScanner file may still be a valid rate confirmation; classify from document content. Proofs of delivery, signed BOLs, receipts, and unrelated scans must have rateConDraft null.
- Put a warning in rateConDraft.warnings for an incomplete address, unclear total, ambiguous broker, or low-confidence stop ordering.
- "handwrittenNotes": Extract ONLY actual handwritten driver/receiver handwriting, signatures, stamped text, or modified numbers. If no handwriting is visible, set to null.
- Return ONLY raw valid JSON.`;
}
async function callGeminiVisionApi(apiKey, fileUrl, base64Data, base64Pages, mimeType = 'image/jpeg', fileName) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const pages = [];
    if (base64Pages === null || base64Pages === void 0 ? void 0 : base64Pages.length) {
        for (const page of base64Pages) {
            const cleaned = page.replace(/^data:[^;]+;base64,/, '');
            if (cleaned)
                pages.push({ mime: 'image/jpeg', data: cleaned });
        }
    }
    if (!pages.length && base64Data) {
        const cleaned = base64Data.replace(/^data:[^;]+;base64,/, '');
        const mime = (mimeType === null || mimeType === void 0 ? void 0 : mimeType.startsWith('image/'))
            ? mimeType
            : mimeType === 'application/pdf'
                ? 'application/pdf'
                : 'image/jpeg';
        pages.push({ mime, data: cleaned });
    }
    if (!pages.length && fileUrl) {
        try {
            const resp = await fetch(fileUrl);
            const arrayBuffer = await resp.arrayBuffer();
            const b64 = Buffer.from(arrayBuffer).toString('base64');
            const mime = mimeType || 'image/jpeg';
            pages.push({ mime, data: b64 });
        }
        catch (e) {
            console.warn('Could not fetch fileUrl directly, proceeding without image bytes:', e);
        }
    }
    if (!pages.length) {
        throw new Error('No image base64 data available to process with Gemini.');
    }
    const imageParts = pages.map((page) => ({
        inline_data: {
            mime_type: page.mime,
            data: page.data,
        },
    }));
    const payload = {
        contents: [
            {
                parts: [{ text: buildVisionPrompt() }, ...imageParts],
            },
        ],
        generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
        },
    };
    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
    let lastError = null;
    for (const modelName of modelsToTry) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errText = await response.text();
                console.warn(`Gemini model ${modelName} returned ${response.status}: ${errText}`);
                lastError = new Error(`Gemini API error (${response.status}): ${errText}`);
                continue;
            }
            const result = await response.json();
            const textOutput = (_e = (_d = (_c = (_b = (_a = result === null || result === void 0 ? void 0 : result.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
            if (!textOutput) {
                continue;
            }
            const cleanedText = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonParsed = JSON.parse(cleanedText);
            const rawBody = jsonParsed.rawText || cleanedText;
            const normDocType = normalizeType(jsonParsed.documentType, rawBody, fileName);
            const regexBol = rawBody.match(/(?:BOL|B\/L|Bill\s*of\s*Lading|Order|Ref)\s*[:#\s]*([A-Z0-9-]{4,25})/i);
            const regexRateConf = rawBody.match(/(?:Rate\s*Conf|Confirmation|Load|Agmt)\s*[:#\s]*([A-Z0-9-]{4,20})/i);
            const regexWeight = rawBody.match(/(?:Gross|Net|Weight|Total\s*Wt)\s*[:#\s]*([0-9,]{4,7}\s*(?:lbs|lb)?)/i);
            const regexRate = rawBody.match(/(?:Total\s*Rate|Total\s*Pay|Linehaul|Amount)\s*[:#\s]*(\$\s*[0-9,]+(?:\.[0-9]{2})?)/i);
            let parsedDraft = normDocType === 'rate_confirmation'
                ? normalizeRateConDraft(jsonParsed.rateConDraft, fileName, {
                    loadRef: jsonParsed.rateConfirmationNumber || ((_f = regexRateConf === null || regexRateConf === void 0 ? void 0 : regexRateConf[1]) === null || _f === void 0 ? void 0 : _f.trim()),
                    payout: jsonParsed.totalRate || ((_g = regexRate === null || regexRate === void 0 ? void 0 : regexRate[1]) === null || _g === void 0 ? void 0 : _g.trim()),
                    originAddress: jsonParsed.originAddress,
                    destinationAddress: jsonParsed.destinationAddress,
                    pickupDate: jsonParsed.pickupDate,
                    deliveryDate: jsonParsed.deliveryDate,
                })
                : undefined;
            if (parsedDraft) {
                parsedDraft = reconcileRateConDraft(parsedDraft);
            }
            return {
                documentType: normDocType,
                bolNumber: jsonParsed.bolNumber || ((_h = regexBol === null || regexBol === void 0 ? void 0 : regexBol[1]) === null || _h === void 0 ? void 0 : _h.trim()) || undefined,
                rateConfirmationNumber: jsonParsed.rateConfirmationNumber || ((_j = regexRateConf === null || regexRateConf === void 0 ? void 0 : regexRateConf[1]) === null || _j === void 0 ? void 0 : _j.trim()) || undefined,
                carrierName: jsonParsed.carrierName || undefined,
                shipperName: jsonParsed.shipperName || undefined,
                consigneeName: jsonParsed.consigneeName || undefined,
                originAddress: jsonParsed.originAddress || undefined,
                destinationAddress: jsonParsed.destinationAddress || undefined,
                pickupDate: jsonParsed.pickupDate || undefined,
                deliveryDate: jsonParsed.deliveryDate || undefined,
                totalRate: jsonParsed.totalRate || ((_k = regexRate === null || regexRate === void 0 ? void 0 : regexRate[1]) === null || _k === void 0 ? void 0 : _k.trim()) || undefined,
                weight: jsonParsed.weight || ((_l = regexWeight === null || regexWeight === void 0 ? void 0 : regexWeight[1]) === null || _l === void 0 ? void 0 : _l.trim()) || undefined,
                handwrittenNotes: jsonParsed.handwrittenNotes || undefined,
                rawText: rawBody,
                confidence: (_m = parsedDraft === null || parsedDraft === void 0 ? void 0 : parsedDraft.confidence) !== null && _m !== void 0 ? _m : 0.98,
                rateConDraft: parsedDraft,
            };
        }
        catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
        }
    }
    throw lastError || new Error('Failed to extract data with Gemini models.');
}
function parseMoney(value) {
    if (!value)
        return null;
    const n = Number.parseFloat(String(value).replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
}
function parseMiles(value) {
    if (!value)
        return null;
    const n = Number.parseFloat(String(value).replace(/[,]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}
/** Inlined FinancialReconciler for Cloud Functions (no shared package dependency). */
function reconcileRateConDraft(draft) {
    var _a;
    const errors = [];
    const warnings = [...(draft.warnings || [])];
    let confidencePenalty = 0;
    const payout = parseMoney(draft.payout);
    const lineHaul = parseMoney(draft.lineHaul);
    const accessorials = parseMoney(draft.accessorials);
    const miles = parseMiles(draft.miles);
    if (payout != null && payout <= 0) {
        errors.push('Total price is zero or negative.');
        confidencePenalty += 0.4;
    }
    if (lineHaul != null && accessorials != null && payout != null) {
        const sum = lineHaul + accessorials;
        if (Math.abs(sum - payout) > 0.05) {
            warnings.push(`Linehaul ($${lineHaul.toFixed(2)}) + accessorials ($${accessorials.toFixed(2)}) does not match payout ($${payout.toFixed(2)}).`);
            confidencePenalty += 0.15;
        }
    }
    else if (payout == null && lineHaul != null && lineHaul > 0) {
        draft.payout = String(lineHaul + (accessorials || 0));
        warnings.push('Payout derived from linehaul/accessorials.');
    }
    const rpmBase = lineHaul !== null && lineHaul !== void 0 ? lineHaul : payout;
    if (miles != null && rpmBase != null && miles > 0) {
        const rpm = rpmBase / miles;
        if (rpm < 0.5 || rpm > 15) {
            warnings.push(`Unusual rate-per-mile ($${rpm.toFixed(2)}/mi) for ${miles} miles.`);
        }
    }
    const pickups = draft.stops.filter((s) => s.type === 'pickup');
    const dropoffs = draft.stops.filter((s) => s.type === 'dropoff');
    if (pickups.length === 0) {
        errors.push('Missing pickup (shipper) location.');
        confidencePenalty += 0.25;
    }
    if (dropoffs.length === 0) {
        errors.push('Missing dropoff (consignee) location.');
        confidencePenalty += 0.25;
    }
    for (const stop of draft.stops) {
        const addr = (stop.address || '').toLowerCase();
        if (CORPORATE_KEYWORDS.some((kw) => addr.includes(kw))) {
            errors.push(`Stop address looks like remit/billing, not a facility: "${stop.address}"`);
            confidencePenalty += 0.3;
        }
    }
    const loadRef = (_a = draft.loadRef) === null || _a === void 0 ? void 0 : _a.trim();
    if (!loadRef || loadRef.length < 2) {
        errors.push('Missing or invalid Load Number.');
        confidencePenalty += 0.3;
    }
    const base = typeof draft.confidence === 'number' ? draft.confidence : 0.9;
    const reconciled = Math.max(0, Math.min(1, base - confidencePenalty));
    return Object.assign(Object.assign({}, draft), { confidence: Math.round(reconciled * 100) / 100, warnings: [...new Set([...warnings, ...errors.map((e) => `Error: ${e}`)])] });
}
function isStrongRateConfirmation(text, fileName = '') {
    const hay = `${text}\n${fileName}`.toLowerCase();
    return (/\brate confirmation\b/.test(hay)
        || /\brate conf\b/.test(hay)
        || /\bload confirmation\b/.test(hay)
        || /\bload tender\b/.test(hay)
        || /\bcarrier load tender\b/.test(hay)
        || /\bline\s*haul\b/.test(hay)
        || /\blinehaul\b/.test(hay)
        || /\bcarrier pay\b/.test(hay)
        || /\bflat rate\b/.test(hay)
        || /\bagreed rate\b/.test(hay)
        || /\brate agreement\b/.test(hay)
        || /carrier_rate_confirmation|rate-confirmation|rateconfirmation/i.test(fileName));
}
function isStrongProofOfDelivery(text, fileName = '') {
    const hay = `${text}\n${fileName}`.toLowerCase();
    // Rate cons often say "send POD with invoice" — that alone is not a POD document.
    if (isStrongRateConfirmation(hay, fileName))
        return false;
    return (/\bproof of delivery\b/.test(hay)
        || /\breceived in good order\b/.test(hay)
        || /\bconsignee signature\b/.test(hay)
        || /\bdelivery receipt\b/.test(hay)
        || (/\breceived by\b/.test(hay) && /\bsignature\b/.test(hay))
        || (/^\s*camscanner/i.test(fileName) && /\b(delivered|signature|proof of delivery)\b/i.test(hay)));
}
function normalizeType(rawType, rawText, fileName) {
    const text = `${rawType || ''} ${rawText || ''} ${fileName || ''}`.toLowerCase();
    const declared = (rawType || '').trim().toLowerCase();
    if (isStrongRateConfirmation(text, fileName || '')) {
        return 'rate_confirmation';
    }
    if (isStrongProofOfDelivery(text, fileName || '')) {
        return 'proof_of_delivery';
    }
    if (text.includes('bill of lading')
        || text.includes('straight bill')
        || text.includes('bol #')
        || text.includes('b/l #')
        || (/\blading\b/.test(text) && !/\brate confirmation\b/.test(text))) {
        return 'bill_of_lading';
    }
    if (text.includes('cat scale')
        || text.includes('weight ticket')
        || text.includes('scale ticket')
        || text.includes('fuel receipt')
        || text.includes('lumper')) {
        return 'receipt';
    }
    const valid = [
        'bill_of_lading',
        'rate_confirmation',
        'proof_of_delivery',
        'receipt',
        'other',
    ];
    if (valid.includes(declared))
        return declared;
    return 'other';
}
function normalizeRateConDraft(raw, fileName, fallback) {
    const rawStops = Array.isArray(raw === null || raw === void 0 ? void 0 : raw.stops) ? raw.stops : [];
    const stops = rawStops
        .filter((stop) => Boolean(stop && typeof stop === 'object'))
        .map((stop, index) => ({
        type: stop.type === 'dropoff' ? 'dropoff' : 'pickup',
        address: String(stop.address || '').trim(),
        sequence: Number.isFinite(Number(stop.sequence)) ? Number(stop.sequence) : index,
    }))
        .filter((stop) => stop.address);
    if (stops.length === 0 && fallback.originAddress) {
        stops.push({ type: 'pickup', address: fallback.originAddress, sequence: 0 });
    }
    if (!stops.some((stop) => stop.type === 'dropoff') && fallback.destinationAddress) {
        stops.push({ type: 'dropoff', address: fallback.destinationAddress, sequence: 0 });
    }
    const miles = (raw === null || raw === void 0 ? void 0 : raw.miles) ? String(raw.miles).trim() : undefined;
    return {
        sourceFile: fileName || 'rate-confirmation',
        loadRef: String((raw === null || raw === void 0 ? void 0 : raw.loadRef) || fallback.loadRef || '').trim() || undefined,
        broker: String((raw === null || raw === void 0 ? void 0 : raw.broker) || '').trim() || undefined,
        payout: String((raw === null || raw === void 0 ? void 0 : raw.payout) || fallback.payout || '').trim() || undefined,
        lineHaul: String((raw === null || raw === void 0 ? void 0 : raw.lineHaul) || '').trim() || undefined,
        accessorials: String((raw === null || raw === void 0 ? void 0 : raw.accessorials) || '').trim() || undefined,
        accessorialDetail: String((raw === null || raw === void 0 ? void 0 : raw.accessorialDetail) || '').trim() || undefined,
        miles,
        milesSource: miles ? 'rate_con' : undefined,
        type: normalizeEquipment(raw === null || raw === void 0 ? void 0 : raw.type),
        pickupDate: String((raw === null || raw === void 0 ? void 0 : raw.pickupDate) || fallback.pickupDate || '').trim() || undefined,
        deliveryDate: String((raw === null || raw === void 0 ? void 0 : raw.deliveryDate) || fallback.deliveryDate || '').trim() || undefined,
        dispatchDate: String((raw === null || raw === void 0 ? void 0 : raw.dispatchDate) || '').trim() || undefined,
        stops,
        confidence: typeof (raw === null || raw === void 0 ? void 0 : raw.confidence) === 'number' ? raw.confidence : 0.75,
        warnings: Array.isArray(raw === null || raw === void 0 ? void 0 : raw.warnings) ? raw.warnings.map(String) : [],
    };
}
function normalizeEquipment(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('reefer') || text.includes('refrigerated'))
        return 'Reefer';
    if (text.includes('flatbed') || text.includes('step deck'))
        return 'Flatbed';
    if (text.includes('dry') || text.includes('van'))
        return 'Dry Van';
    return undefined;
}
function generateDevMockExtraction(fileName) {
    const docType = normalizeType(undefined, undefined, fileName);
    return {
        documentType: docType,
        rawText: 'Document uploaded and queued for vision extraction',
        confidence: 0.8,
    };
}
//# sourceMappingURL=extractDocument.js.map