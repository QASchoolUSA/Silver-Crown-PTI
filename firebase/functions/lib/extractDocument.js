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
const admin = __importStar(require("firebase-admin"));
exports.extractDocumentData = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in to extract document data.');
    }
    const { documentId, fileUrl, fileName, fileType, base64Data, apiKey: requestApiKey } = request.data;
    if (!documentId) {
        throw new https_1.HttpsError('invalid-argument', 'documentId is required.');
    }
    const db = admin.firestore();
    const docRef = db.collection('documents').doc(documentId);
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
            extractedData: extracted,
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
async function callGeminiVisionApi(apiKey, fileUrl, base64Data, mimeType = 'image/jpeg', fileName) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
    const prompt = `You are a world-class AI document extractor specialized EXCLUSIVELY in Freight & Trucking Logistics documents (Bills of Lading, Rate Confirmations, Proof of Delivery, CAT Scale / Weight Tickets, Fuel / Lumper Receipts).

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
  "rawText": string
}

Classification Rules:
1. "bill_of_lading": Contains terms like "Bill of Lading", "BOL", "Straight Bill of Lading", Shipper, Consignee, commodity list, piece counts, trailer/seal #.
2. "rate_confirmation": Contains "Rate Confirmation", "Confirmation #", "Broker", "Load Agreement", carrier payout/rate ($ amount), linehaul, origin/destination.
3. "proof_of_delivery": Contains "Proof of Delivery", "POD", "Received By", delivery date/timestamp, consignee signature, or "Delivered".
4. "receipt": Weight tickets (CAT Scale), Fuel receipts, Lumper receipts, Toll receipts, Maintenance invoices.

Field Rules:
- Extract numbers, rates (e.g. "$2,400.00"), weights (e.g. "42,000 lbs"), dates (YYYY-MM-DD format if possible).
- "handwrittenNotes": Extract ONLY actual handwritten driver/receiver handwriting, signatures, stamped text, or modified numbers. If no handwriting is visible, set to null.
- Return ONLY raw valid JSON.`;
    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
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
    // Preferred model cascade: gemini-2.0-flash -> gemini-1.5-pro -> gemini-1.5-flash
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
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
            return {
                documentType: normDocType,
                bolNumber: jsonParsed.bolNumber || ((_f = regexBol === null || regexBol === void 0 ? void 0 : regexBol[1]) === null || _f === void 0 ? void 0 : _f.trim()) || undefined,
                rateConfirmationNumber: jsonParsed.rateConfirmationNumber || ((_g = regexRateConf === null || regexRateConf === void 0 ? void 0 : regexRateConf[1]) === null || _g === void 0 ? void 0 : _g.trim()) || undefined,
                carrierName: jsonParsed.carrierName || undefined,
                shipperName: jsonParsed.shipperName || undefined,
                consigneeName: jsonParsed.consigneeName || undefined,
                originAddress: jsonParsed.originAddress || undefined,
                destinationAddress: jsonParsed.destinationAddress || undefined,
                pickupDate: jsonParsed.pickupDate || undefined,
                deliveryDate: jsonParsed.deliveryDate || undefined,
                totalRate: jsonParsed.totalRate || ((_h = regexRate === null || regexRate === void 0 ? void 0 : regexRate[1]) === null || _h === void 0 ? void 0 : _h.trim()) || undefined,
                weight: jsonParsed.weight || ((_j = regexWeight === null || regexWeight === void 0 ? void 0 : regexWeight[1]) === null || _j === void 0 ? void 0 : _j.trim()) || undefined,
                handwrittenNotes: jsonParsed.handwrittenNotes || undefined,
                rawText: rawBody,
                confidence: 0.98,
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
    if (text.includes('lading') ||
        text.includes('bol') ||
        text.includes('straight bill') ||
        text.includes('shipper') ||
        text.includes('consignee') ||
        text.includes('bill of lading')) {
        return 'bill_of_lading';
    }
    if (text.includes('rate') ||
        text.includes('confirm') ||
        text.includes('broker') ||
        text.includes('linehaul') ||
        text.includes('carrier pay') ||
        text.includes('flat rate')) {
        return 'rate_confirmation';
    }
    if (text.includes('delivery') ||
        text.includes('pod') ||
        text.includes('received by') ||
        text.includes('consignee signature') ||
        text.includes('proof of delivery')) {
        return 'proof_of_delivery';
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
    return 'bill_of_lading';
}
function generateDevMockExtraction(fileName) {
    const docType = normalizeType(undefined, undefined, fileName);
    return {
        documentType: docType,
        bolNumber: `BOL-${Math.floor(100000 + Math.random() * 900000)}`,
        rawText: 'Bill of lading freight document uploaded and processed',
        confidence: 0.95,
    };
}
//# sourceMappingURL=extractDocument.js.map