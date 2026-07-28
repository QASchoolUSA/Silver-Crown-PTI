/**
 * Upgrade extractDocument Cloud Function with VLM-quality rate-con prompts,
 * multi-page image parts, financial reconcile, and Gemini model fallbacks.
 */
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

export interface ExtractDocumentRequest {
  documentId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  base64Data?: string;
  /** Additional page images (JPEG/PNG base64 without data: prefix). */
  base64Pages?: string[];
  apiKey?: string;
}

export interface ExtractedDocData {
  documentType: 'bill_of_lading' | 'rate_confirmation' | 'proof_of_delivery' | 'receipt' | 'other';
  bolNumber?: string;
  rateConfirmationNumber?: string;
  carrierName?: string;
  shipperName?: string;
  consigneeName?: string;
  originAddress?: string;
  destinationAddress?: string;
  pickupDate?: string;
  deliveryDate?: string;
  totalRate?: string;
  weight?: string;
  handwrittenNotes?: string;
  rawText?: string;
  confidence?: number;
  rateConDraft?: RateConDraft;
}

interface RateConDraft {
  sourceFile: string;
  loadRef?: string;
  broker?: string;
  payout?: string;
  lineHaul?: string;
  accessorials?: string;
  accessorialDetail?: string;
  miles?: string;
  milesSource?: 'rate_con';
  type?: 'Dry Van' | 'Reefer' | 'Flatbed';
  pickupDate?: string;
  deliveryDate?: string;
  dispatchDate?: string;
  stops: Array<{
    type: 'pickup' | 'dropoff';
    address: string;
    sequence: number;
  }>;
  confidence?: number;
  warnings?: string[];
}

const CORPORATE_KEYWORDS = [
  'remit to',
  'corporate hq',
  'billing office',
  'p.o. box',
  'po box',
  'factoring',
];

export const extractDocumentData = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to extract document data.');
  }

  const {
    documentId,
    fileUrl,
    fileName,
    fileType,
    base64Data,
    base64Pages,
    apiKey: requestApiKey,
  } = request.data as ExtractDocumentRequest;

  if (!documentId) {
    throw new HttpsError('invalid-argument', 'documentId is required.');
  }

  const db = admin.firestore();
  const docRef = db.collection('documents').doc(documentId);
  const [userSnap, documentSnap] = await Promise.all([
    db.collection('users').doc(request.auth.uid).get(),
    docRef.get(),
  ]);
  const userData = userSnap.data();
  const documentData = documentSnap.data();
  if (
    !userSnap.exists
    || userData?.role !== 'admin'
    || !documentSnap.exists
    || documentData?.companyId !== userData.companyId
  ) {
    throw new HttpsError('permission-denied', 'Admin access to this document is required.');
  }

  // Secret is injected as GEMINI_API_KEY when secrets: [geminiApiKey] is set.
  let apiKey = requestApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    try {
      apiKey = geminiApiKey.value();
    } catch {
      apiKey = undefined;
    }
  }

  try {
    let extracted: ExtractedDocData;

    if (apiKey) {
      extracted = await callGeminiVisionApi(
        apiKey,
        fileUrl,
        base64Data,
        base64Pages,
        fileType,
        fileName
      );
    } else {
      extracted = generateDevMockExtraction(fileName);
    }

    await docRef.update({
      extractedData: stripUndefined(extracted),
      docType: extracted.documentType || 'other',
      status: 'processed',
      updatedAt: new Date().toISOString(),
    });

    return { success: true, extractedData: extracted };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Extraction failed';
    await docRef.update({
      status: 'error',
      errorMessage: errMessage,
      updatedAt: new Date().toISOString(),
    });

    throw new HttpsError('internal', `Failed to process document: ${errMessage}`);
  }
});

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, stripUndefined(nested)])
    ) as T;
  }
  return value;
}

function buildVisionPrompt(): string {
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
3. "proof_of_delivery": Contains "Proof of Delivery", "POD", "Received By", delivery date/timestamp, consignee signature, or "Delivered".
4. "receipt": Weight tickets (CAT Scale), Fuel receipts, Lumper receipts, Toll receipts, Maintenance invoices.

Rate Confirmation / VLM Field Rules:
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

async function callGeminiVisionApi(
  apiKey: string,
  fileUrl: string,
  base64Data?: string,
  base64Pages?: string[],
  mimeType: string = 'image/jpeg',
  fileName?: string
): Promise<ExtractedDocData> {
  const pages: Array<{ mime: string; data: string }> = [];

  if (base64Pages?.length) {
    for (const page of base64Pages) {
      const cleaned = page.replace(/^data:[^;]+;base64,/, '');
      if (cleaned) pages.push({ mime: 'image/jpeg', data: cleaned });
    }
  }

  if (!pages.length && base64Data) {
    const cleaned = base64Data.replace(/^data:[^;]+;base64,/, '');
    const mime = mimeType?.startsWith('image/')
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
    } catch (e) {
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
  let lastError: Error | null = null;

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
      const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;

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
            loadRef: jsonParsed.rateConfirmationNumber || regexRateConf?.[1]?.trim(),
            payout: jsonParsed.totalRate || regexRate?.[1]?.trim(),
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
        bolNumber: jsonParsed.bolNumber || regexBol?.[1]?.trim() || undefined,
        rateConfirmationNumber: jsonParsed.rateConfirmationNumber || regexRateConf?.[1]?.trim() || undefined,
        carrierName: jsonParsed.carrierName || undefined,
        shipperName: jsonParsed.shipperName || undefined,
        consigneeName: jsonParsed.consigneeName || undefined,
        originAddress: jsonParsed.originAddress || undefined,
        destinationAddress: jsonParsed.destinationAddress || undefined,
        pickupDate: jsonParsed.pickupDate || undefined,
        deliveryDate: jsonParsed.deliveryDate || undefined,
        totalRate: jsonParsed.totalRate || regexRate?.[1]?.trim() || undefined,
        weight: jsonParsed.weight || regexWeight?.[1]?.trim() || undefined,
        handwrittenNotes: jsonParsed.handwrittenNotes || undefined,
        rawText: rawBody,
        confidence: parsedDraft?.confidence ?? 0.98,
        rateConDraft: parsedDraft,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('Failed to extract data with Gemini models.');
}

function parseMoney(value?: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseMiles(value?: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Inlined FinancialReconciler for Cloud Functions (no shared package dependency). */
function reconcileRateConDraft(draft: RateConDraft): RateConDraft {
  const errors: string[] = [];
  const warnings: string[] = [...(draft.warnings || [])];
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
      warnings.push(
        `Linehaul ($${lineHaul.toFixed(2)}) + accessorials ($${accessorials.toFixed(2)}) does not match payout ($${payout.toFixed(2)}).`
      );
      confidencePenalty += 0.15;
    }
  } else if (payout == null && lineHaul != null && lineHaul > 0) {
    draft.payout = String(lineHaul + (accessorials || 0));
    warnings.push('Payout derived from linehaul/accessorials.');
  }

  const rpmBase = lineHaul ?? payout;
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

  const loadRef = draft.loadRef?.trim();
  if (!loadRef || loadRef.length < 2) {
    errors.push('Missing or invalid Load Number.');
    confidencePenalty += 0.3;
  }

  const base = typeof draft.confidence === 'number' ? draft.confidence : 0.9;
  const reconciled = Math.max(0, Math.min(1, base - confidencePenalty));

  return {
    ...draft,
    confidence: Math.round(reconciled * 100) / 100,
    warnings: [...new Set([...warnings, ...errors.map((e) => `Error: ${e}`)])],
  };
}

function normalizeType(
  rawType?: string,
  rawText?: string,
  fileName?: string
): ExtractedDocData['documentType'] {
  const text = `${rawType || ''} ${rawText || ''} ${fileName || ''}`.toLowerCase();

  if (
    text.includes('proof of delivery')
    || text.includes('received by')
    || text.includes('consignee signature')
    || /\bpod\b/.test(text)
  ) {
    return 'proof_of_delivery';
  }
  if (
    text.includes('rate confirmation')
    || text.includes('rate agreement')
    || text.includes('carrier pay')
    || text.includes('flat rate')
    || text.includes('linehaul')
    || text.includes('broker')
  ) {
    return 'rate_confirmation';
  }
  if (
    text.includes('lading')
    || text.includes('bol')
    || text.includes('straight bill')
    || text.includes('shipper')
    || text.includes('consignee')
    || text.includes('bill of lading')
  ) {
    return 'bill_of_lading';
  }
  if (
    text.includes('scale')
    || text.includes('cat scale')
    || text.includes('gross')
    || text.includes('tare')
    || text.includes('receipt')
    || text.includes('fuel')
    || text.includes('lumper')
    || text.includes('weight ticket')
  ) {
    return 'receipt';
  }

  return 'other';
}

function normalizeRateConDraft(
  raw: Record<string, unknown> | null | undefined,
  fileName: string | undefined,
  fallback: {
    loadRef?: string;
    payout?: string;
    originAddress?: string;
    destinationAddress?: string;
    pickupDate?: string;
    deliveryDate?: string;
  }
): RateConDraft {
  const rawStops = Array.isArray(raw?.stops) ? raw.stops : [];
  const stops = rawStops
    .filter((stop): stop is Record<string, unknown> => Boolean(stop && typeof stop === 'object'))
    .map((stop, index) => ({
      type: stop.type === 'dropoff' ? 'dropoff' as const : 'pickup' as const,
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

  const miles = raw?.miles ? String(raw.miles).trim() : undefined;
  return {
    sourceFile: fileName || 'rate-confirmation',
    loadRef: String(raw?.loadRef || fallback.loadRef || '').trim() || undefined,
    broker: String(raw?.broker || '').trim() || undefined,
    payout: String(raw?.payout || fallback.payout || '').trim() || undefined,
    lineHaul: String(raw?.lineHaul || '').trim() || undefined,
    accessorials: String(raw?.accessorials || '').trim() || undefined,
    accessorialDetail: String(raw?.accessorialDetail || '').trim() || undefined,
    miles,
    milesSource: miles ? 'rate_con' : undefined,
    type: normalizeEquipment(raw?.type),
    pickupDate: String(raw?.pickupDate || fallback.pickupDate || '').trim() || undefined,
    deliveryDate: String(raw?.deliveryDate || fallback.deliveryDate || '').trim() || undefined,
    dispatchDate: String(raw?.dispatchDate || '').trim() || undefined,
    stops,
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0.75,
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map(String) : [],
  };
}

function normalizeEquipment(value: unknown): RateConDraft['type'] {
  const text = String(value || '').toLowerCase();
  if (text.includes('reefer') || text.includes('refrigerated')) return 'Reefer';
  if (text.includes('flatbed') || text.includes('step deck')) return 'Flatbed';
  if (text.includes('dry') || text.includes('van')) return 'Dry Van';
  return undefined;
}

function generateDevMockExtraction(fileName: string): ExtractedDocData {
  const docType = normalizeType(undefined, undefined, fileName);

  return {
    documentType: docType,
    rawText: 'Document uploaded and queued for vision extraction',
    confidence: 0.8,
  };
}
