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

export interface GeminiUsageMetadata {
  model: string;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiExtractResult {
  extracted: ExtractedDocData;
  usage?: GeminiUsageMetadata;
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
    let usage: GeminiUsageMetadata | undefined;

    if (apiKey) {
      const result = await callGeminiVisionApi(
        apiKey,
        fileUrl,
        base64Data,
        base64Pages,
        fileType,
        fileName
      );
      extracted = result.extracted;
      usage = result.usage;
    } else {
      extracted = generateDevMockExtraction(fileName);
    }

    await docRef.update({
      extractedData: stripUndefined(extracted),
      docType: extracted.documentType || 'other',
      status: 'processed',
      updatedAt: new Date().toISOString(),
    });

    return { success: true, extractedData: extracted, usage };
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
  return `You are a freight-document extraction engine. Return factual printed fields only. Never invent miles, money, addresses, or stop order.

Extract structured JSON matching this exact schema (do NOT transcribe the full page into rawText — set rawText to null):
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
  "rawText": null,
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
        "address": "street, city, state ZIP only (no facility/shed name)",
        "sequence": number starting at 0 within that stop type
      }
    ],
    "confidence": number from 0 to 1,
    "warnings": string[]
  } or null
}

Classification:
1. rate_confirmation: Rate Confirmation / Load Tender / Line Haul / Flat Rate / carrier pay (even if text mentions sending PODs with invoices).
2. proof_of_delivery: document title/purpose is Proof of Delivery with receiver signature — not rate cons that mention POD for billing.
3. bill_of_lading: Bill of Lading / BOL as primary document.
4. receipt: scale/fuel/lumper tickets.

Rate-con rules:
- Street + city + state + ZIP only for stops. Integrity Express "Shed:GO FAST Address: 153 WINYAH RD CONWAY, SC 29526" → "153 WINYAH RD, CONWAY, SC 29526".
- Ignore remit-to / billing / P.O. Box addresses.
- Keep every pickup and dropoff in printed order.
- miles only if printed; never estimate.
- rateConDraft null for POD/BOL/receipt/other.
- Return ONLY valid JSON.`;
}

async function callGeminiVisionApi(
  apiKey: string,
  fileUrl: string,
  base64Data?: string,
  base64Pages?: string[],
  mimeType: string = 'image/jpeg',
  fileName?: string
): Promise<GeminiExtractResult> {
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

  // Newer Flash-Lite first (2.5-flash / 2.0-flash return 404 for many new API keys).
  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
  ];
  let lastError: Error | null = null;
  const triedErrors: string[] = [];

  for (const modelName of modelsToTry) {
    try {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.1,
        response_mime_type: 'application/json',
        maxOutputTokens: 2048,
      };
      // Gemini 2.5 Flash (non-lite) defaults thinking on — disable when we hit that alias.
      if (/2\.5-flash(?!-lite)/i.test(modelName) || modelName === 'gemini-flash-latest') {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const payload = {
        contents: [
          {
            parts: [{ text: buildVisionPrompt() }, ...imageParts],
          },
        ],
        generationConfig,
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Gemini model ${modelName} returned ${response.status}: ${errText}`);
        triedErrors.push(`${modelName}: ${response.status}`);
        lastError = new Error(`Gemini API error (${response.status}): ${errText}`);
        // Retired models / missing IDs — try next immediately
        if (response.status === 404 || /no longer available/i.test(errText)) {
          continue;
        }
        continue;
      }

      const result = await response.json();
      const usageMeta = result?.usageMetadata || {};
      const usage: GeminiUsageMetadata = {
        model: modelName,
        promptTokenCount: usageMeta.promptTokenCount,
        candidatesTokenCount: usageMeta.candidatesTokenCount,
        thoughtsTokenCount: usageMeta.thoughtsTokenCount ?? usageMeta.totalThoughtTokens,
        totalTokenCount: usageMeta.totalTokenCount,
      };
      console.info(
        `[extractDocumentData] Gemini usage model=${usage.model} prompt=${usage.promptTokenCount ?? '?'} candidates=${usage.candidatesTokenCount ?? '?'} thoughts=${usage.thoughtsTokenCount ?? 0} total=${usage.totalTokenCount ?? '?'}`
      );

      const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textOutput) {
        continue;
      }

      const cleanedText = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonParsed = JSON.parse(cleanedText);

      // Prefer structured fields; avoid huge rawText dumps (cost + storage).
      const rawBody =
        typeof jsonParsed.rawText === 'string' && jsonParsed.rawText.trim().length > 0
          ? jsonParsed.rawText.slice(0, 500)
          : [
              jsonParsed.documentType,
              jsonParsed.rateConfirmationNumber,
              jsonParsed.bolNumber,
              jsonParsed.totalRate,
              jsonParsed.originAddress,
              jsonParsed.destinationAddress,
              fileName,
            ]
              .filter(Boolean)
              .join(' ');

      const normDocType = normalizeType(jsonParsed.documentType, rawBody, fileName);
      let parsedDraft = normDocType === 'rate_confirmation'
        ? normalizeRateConDraft(jsonParsed.rateConDraft, fileName, {
            loadRef: jsonParsed.rateConfirmationNumber,
            payout: jsonParsed.totalRate,
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
        extracted: {
          documentType: normDocType,
          bolNumber: jsonParsed.bolNumber || undefined,
          rateConfirmationNumber: jsonParsed.rateConfirmationNumber || undefined,
          carrierName: jsonParsed.carrierName || undefined,
          shipperName: jsonParsed.shipperName || undefined,
          consigneeName: jsonParsed.consigneeName || undefined,
          originAddress: jsonParsed.originAddress || undefined,
          destinationAddress: jsonParsed.destinationAddress || undefined,
          pickupDate: jsonParsed.pickupDate || undefined,
          deliveryDate: jsonParsed.deliveryDate || undefined,
          totalRate: jsonParsed.totalRate || undefined,
          weight: jsonParsed.weight || undefined,
          handwrittenNotes: jsonParsed.handwrittenNotes || undefined,
          rawText: undefined,
          confidence: parsedDraft?.confidence ?? 0.95,
          rateConDraft: parsedDraft,
        },
        usage,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error(
    `Failed to extract data with Gemini models (${triedErrors.join('; ') || 'no details'}).`
  );
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

function isStrongRateConfirmation(text: string, fileName: string = ''): boolean {
  const hay = `${text}\n${fileName}`.toLowerCase();
  return (
    /\brate confirmation\b/.test(hay)
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
    || /carrier_rate_confirmation|rate-confirmation|rateconfirmation/i.test(fileName)
  );
}

function isStrongProofOfDelivery(text: string, fileName: string = ''): boolean {
  const hay = `${text}\n${fileName}`.toLowerCase();
  // Rate cons often say "send POD with invoice" — that alone is not a POD document.
  if (isStrongRateConfirmation(hay, fileName)) return false;
  return (
    /\bproof of delivery\b/.test(hay)
    || /\breceived in good order\b/.test(hay)
    || /\bconsignee signature\b/.test(hay)
    || /\bdelivery receipt\b/.test(hay)
    || (/\breceived by\b/.test(hay) && /\bsignature\b/.test(hay))
    || (/^\s*camscanner/i.test(fileName) && /\b(delivered|signature|proof of delivery)\b/i.test(hay))
  );
}

function normalizeType(
  rawType?: string,
  rawText?: string,
  fileName?: string
): ExtractedDocData['documentType'] {
  const text = `${rawType || ''} ${rawText || ''} ${fileName || ''}`.toLowerCase();
  const declared = (rawType || '').trim().toLowerCase() as ExtractedDocData['documentType'];

  if (isStrongRateConfirmation(text, fileName || '')) {
    return 'rate_confirmation';
  }
  if (isStrongProofOfDelivery(text, fileName || '')) {
    return 'proof_of_delivery';
  }
  if (
    text.includes('bill of lading')
    || text.includes('straight bill')
    || text.includes('bol #')
    || text.includes('b/l #')
    || (/\blading\b/.test(text) && !/\brate confirmation\b/.test(text))
  ) {
    return 'bill_of_lading';
  }
  if (
    text.includes('cat scale')
    || text.includes('weight ticket')
    || text.includes('scale ticket')
    || text.includes('fuel receipt')
    || text.includes('lumper')
  ) {
    return 'receipt';
  }

  const valid: ExtractedDocData['documentType'][] = [
    'bill_of_lading',
    'rate_confirmation',
    'proof_of_delivery',
    'receipt',
    'other',
  ];
  if (valid.includes(declared)) return declared;

  return 'other';
}

const STREET_TYPE =
  String.raw`st|street|ave|avenue|blvd|boulevard|rd|road|way|dr|drive|hwy|highway|ln|lane|ct|court|cir|circle|pkwy|parkway|pl|place|trl|trail|ter|terrace|gate`;

const US_STATE_CODES_SET = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

/** Drop shed/facility names; keep street + city/state/ZIP only (mirrored from shared addressFormat). */
function normalizeStopAddress(address: string): string {
  let raw = (address || '').trim();
  if (!raw) return '';

  const afterAddressLabel = raw.match(/\bAddress:\s*(.+)$/i);
  if (afterAddressLabel) raw = afterAddressLabel[1].trim();
  raw = raw
    .replace(/^Shed:\s*[^\n]*?(?=\bAddress:|\b\d{1,6}\s)/i, '')
    .replace(/^Shed:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const streetStart = raw.search(/\b\d{1,6}\s+[A-Za-z0-9]/);
  if (streetStart < 0) return raw;
  let rest = raw.slice(streetStart).trim();
  rest = rest.replace(/\s+(?:Phone|Date|Time|Appt|Remarks|Pallets|Pieces)\b.*$/i, '').trim();

  const withComma = rest.match(
    new RegExp(
      String.raw`^(\d[^,]*?\b(?:${STREET_TYPE})\.?)\s*,\s*([^,]+)\s*,\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$`,
      'i'
    )
  );
  if (withComma && US_STATE_CODES_SET.has(withComma[3].toUpperCase())) {
    const city = withComma[2].trim().replace(/\s+/g, ' ');
    const zip = (withComma[4] || '').trim();
    const state = withComma[3].toUpperCase();
    return zip
      ? `${withComma[1].trim()}, ${city}, ${state} ${zip}`
      : `${withComma[1].trim()}, ${city}, ${state}`;
  }

  const noComma = rest.match(
    new RegExp(
      String.raw`^(\d.+?\b(?:${STREET_TYPE})\.?)\s+([A-Za-z .'-]+)\s*,\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$`,
      'i'
    )
  );
  if (noComma && US_STATE_CODES_SET.has(noComma[3].toUpperCase())) {
    const city = noComma[2].trim().replace(/\s+/g, ' ');
    const zip = (noComma[4] || '').trim();
    const state = noComma[3].toUpperCase();
    return zip
      ? `${noComma[1].trim()}, ${city}, ${state} ${zip}`
      : `${noComma[1].trim()}, ${city}, ${state}`;
  }

  return rest;
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
      address: normalizeStopAddress(String(stop.address || '').trim()),
      sequence: Number.isFinite(Number(stop.sequence)) ? Number(stop.sequence) : index,
    }))
    .filter((stop) => stop.address);

  if (stops.length === 0 && fallback.originAddress) {
    stops.push({
      type: 'pickup',
      address: normalizeStopAddress(fallback.originAddress),
      sequence: 0,
    });
  }
  if (!stops.some((stop) => stop.type === 'dropoff') && fallback.destinationAddress) {
    stops.push({
      type: 'dropoff',
      address: normalizeStopAddress(fallback.destinationAddress),
      sequence: 0,
    });
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
