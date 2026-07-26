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
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
exports.extractDocumentData = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to extract document data.');
    }
    const { documentId, fileUrl, fileName, fileType, base64Data, apiKey: requestApiKey } = request.data;
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
    const apiKey = requestApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    try {
        let extracted;
        if (apiKey) {
            extracted = await callGeminiVisionApi(apiKey, fileUrl, base64Data, fileType, fileName);
        }
        else {
            // Intelligent fallback when API key is not configured in local environment
            extracted = generateDevMockExtraction(fileName);
        }
        // Update Firestore document with extracted data & status
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
async function callGeminiVisionApi(apiKey, fileUrl, base64Data, mimeType = 'image/jpeg', fileName) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    let imageB64 = base64Data;
    if (!imageB64 && fileUrl) {
        try {
            const resp = await fetch(fileUrl);
            const arrayBuffer = await resp.arrayBuffer();
            imageB64 = Buffer.from(arrayBuffer).toString('base64');
        }
        catch (e) {
            console.warn('Could not fetch fileUrl directly, proceeding without image bytes:', e);
        }
    }
    if (!imageB64) {
        throw new Error('No image base64 data available to process with Gemini.');
    }
    const prompt = `You are a freight-document extraction engine used by experienced truck dispatchers. Transcribe the document and return factual data only. Never infer printed miles, money, addresses, or stop order.

Perform a 2-stage analysis of this document image:
STAGE 1: Transcribe ALL text on the page into "rawText" (including headers, table cells, stamps, seal numbers, and handwritten notes).
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
        "address": "full printed street, city, state, ZIP",
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
3. "proof_of_delivery": Contains "Proof of Delivery", "POD", "Received By", delivery date/timestamp, consignee signature, or "Delivered".
4. "receipt": Weight tickets (CAT Scale), Fuel receipts, Lumper receipts, Toll receipts, Maintenance invoices.

Field Rules:
- Extract numbers, rates (e.g. "$2,400.00"), weights (e.g. "42,000 lbs"), dates (YYYY-MM-DD format if possible).
- For a rate confirmation, include every pickup and delivery in the printed operational order. Preserve multiple pickups and multiple dropoffs. Do not collapse them into one origin and destination.
- "payout" is the total carrier gross/flat rate. "lineHaul" excludes fuel surcharge and accessorials. "accessorials" is their total; explain components in "accessorialDetail".
- "loadRef" is the broker load/order/confirmation number used to identify the load.
- "broker" is the broker/logistics company issuing the confirmation, not the carrier.
- Set "miles" only when mileage is explicitly printed. Never calculate or estimate it. When printed, it will later be marked as rate_con mileage.
- A CamScanner file may still be a valid rate confirmation; classify from document content. Proofs of delivery, signed BOLs, receipts, and unrelated scans must have rateConDraft null.
- Put a warning in rateConDraft.warnings for an incomplete address, unclear total, ambiguous broker, or low-confidence stop ordering.
- "handwrittenNotes": Extract ONLY actual handwritten driver/receiver handwriting, signatures, stamped text, or modified numbers. If no handwriting is visible, set to null.
- Return ONLY raw valid JSON.`;
    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType || 'application/pdf',
                            data: imageB64,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
        },
    };
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
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
            // Heuristic fallback text parsing to fill any missing fields from rawText
            const rawBody = jsonParsed.rawText || cleanedText;
            const normDocType = normalizeType(jsonParsed.documentType, rawBody, fileName);
            const regexBol = rawBody.match(/(?:BOL|B\/L|Bill\s*of\s*Lading|Order|Ref)\s*[:#\s]*([A-Z0-9-]{4,25})/i);
            const regexRateConf = rawBody.match(/(?:Rate\s*Conf|Confirmation|Load|Agmt)\s*[:#\s]*([A-Z0-9-]{4,20})/i);
            const regexWeight = rawBody.match(/(?:Gross|Net|Weight|Total\s*Wt)\s*[:#\s]*([0-9,]{4,7}\s*(?:lbs|lb)?)/i);
            const regexRate = rawBody.match(/(?:Total\s*Rate|Total\s*Pay|Linehaul|Amount)\s*[:#\s]*(\$\s*[0-9,]+(?:\.[0-9]{2})?)/i);
            const parsedDraft = normDocType === 'rate_confirmation'
                ? normalizeRateConDraft(jsonParsed.rateConDraft, fileName, {
                    loadRef: jsonParsed.rateConfirmationNumber || ((_f = regexRateConf === null || regexRateConf === void 0 ? void 0 : regexRateConf[1]) === null || _f === void 0 ? void 0 : _f.trim()),
                    payout: jsonParsed.totalRate || ((_g = regexRate === null || regexRate === void 0 ? void 0 : regexRate[1]) === null || _g === void 0 ? void 0 : _g.trim()),
                    originAddress: jsonParsed.originAddress,
                    destinationAddress: jsonParsed.destinationAddress,
                    pickupDate: jsonParsed.pickupDate,
                    deliveryDate: jsonParsed.deliveryDate,
                })
                : undefined;
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
function normalizeType(rawType, rawText, fileName) {
    const text = `${rawType || ''} ${rawText || ''} ${fileName || ''}`.toLowerCase();
    if (text.includes('proof of delivery') ||
        text.includes('received by') ||
        text.includes('consignee signature') ||
        /\bpod\b/.test(text)) {
        return 'proof_of_delivery';
    }
    if (text.includes('rate confirmation') ||
        text.includes('rate agreement') ||
        text.includes('carrier pay') ||
        text.includes('flat rate') ||
        text.includes('linehaul') ||
        text.includes('broker')) {
        return 'rate_confirmation';
    }
    if (text.includes('lading') ||
        text.includes('bol') ||
        text.includes('straight bill') ||
        text.includes('shipper') ||
        text.includes('consignee') ||
        text.includes('bill of lading')) {
        return 'bill_of_lading';
    }
    if (text.includes('scale') ||
        text.includes('cat scale') ||
        text.includes('gross') ||
        text.includes('tare') ||
        text.includes('receipt') ||
        text.includes('fuel') ||
        text.includes('lumper') ||
        text.includes('weight ticket')) {
        return 'receipt';
    }
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
        confidence: 0.80,
    };
}
//# sourceMappingURL=extractDocument.js.map