import type { DocumentType, EquipmentType, RateConDraft, RateConStop } from '../types';
import { normalizeStopAddress } from './addressFormat';
import { normalizeDocumentType } from './freightParser';

export interface ParseRateConfirmationResult {
  documentType: DocumentType;
  draft: RateConDraft | null;
  rawText: string;
  confidence: number;
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

const FILENAME_ID_PATTERNS: Array<{ pat: RegExp; prefix?: string }> = [
  { pat: /Carrier_Rate_Confirmation_(\d+)/i },
  { pat: /(\d+)-rateconfirmation/i },
  { pat: /AT41M(\d+)-Rate-Confirmation/i, prefix: 'AT41M' },
  { pat: /Load Confirmation (\d+)/i },
  { pat: /LoadConfirmation(\d+)/i },
  { pat: /CarrierRateConfirmation-(LD\d+)/i },
  { pat: /CarrierRateConfirmation-(EL\d+)/i },
  { pat: /Tender-(VP\d+)/i },
  { pat: /RateConfirmation(\d+)/i },
  { pat: /^(\d+)\.pdf$/i },
];

const BROKER_PATTERNS: Array<{ pat: RegExp; name: string }> = [
  { pat: /Priority\s*1/i, name: 'Priority 1' },
  { pat: /Corporate Traffic/i, name: 'Corporate Traffic' },
  { pat: /Allys Transportation|allystrans\.com/i, name: 'Allys Transportation' },
  { pat: /Nolan Transportation Group|\bNTG\b/i, name: 'NTG' },
  { pat: /Spot Freight|MySpotCarrier/i, name: 'Spot Freight' },
  { pat: /ATN,?\s*LLC|ATN Global|atnglobal\.com/i, name: 'ATN' },
  { pat: /Ryan Transportation|RyanTrans/i, name: 'Ryan Transportation' },
  { pat: /Landstar/i, name: 'Landstar' },
  { pat: /GlobalTranz|globaltranz\.com/i, name: 'GlobalTranz' },
  { pat: /BM2\s*Freight|bm2freight\.com/i, name: 'BM2 Freight' },
  { pat: /\bNFI\b|nfiindustries\.com|Transplace/i, name: 'NFI / Transplace' },
  { pat: /Total Quality Logistics|\bTQL\b/i, name: 'TQL' },
  { pat: /CH Robinson|C\.H\. Robinson/i, name: 'CH Robinson' },
  { pat: /Echo Global/i, name: 'Echo Global' },
  { pat: /Arrive Logistics/i, name: 'Arrive Logistics' },
  { pat: /Loadsmart/i, name: 'Loadsmart' },
  { pat: /Werner Logistics/i, name: 'Werner Logistics' },
  { pat: /Coyote Logistics/i, name: 'Coyote Logistics' },
  { pat: /Freight Tec|FREIGHT TEC/i, name: 'Freight Tec' },
  { pat: /BBI Logistics|BBI Carrier/i, name: 'BBI Logistics' },
  { pat: /Axle Logistics|axlelogistics\.com/i, name: 'Axle Logistics' },
  { pat: /Forward Air|forwardair\.com/i, name: 'Forward Air Logistics' },
  { pat: /FitzMark|fitzmark\.com/i, name: 'FitzMark' },
  { pat: /Magellan|magellantransport\.com/i, name: 'Magellan Transport' },
  { pat: /Translogistics|shiptli\.com/i, name: 'Translogistics (TLI)' },
];

function parseMoney(s: string): number | undefined {
  const m = s.replace(/,/g, '').match(/([\d]+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : undefined;
}

function moneyString(val: number | undefined): string | undefined {
  if (val == null || !Number.isFinite(val)) return undefined;
  return String(val);
}

function normalizeLoadId(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

function normalizeSpacedText(text: string): string {
  const cleaned = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[^\S\n]+/g, ' ');
  return cleaned
    .split('\n')
    .map((line) =>
      /(?:[A-Za-z0-9]\s){4,}[A-Za-z0-9]/.test(line)
        ? line.replace(/(?<=[A-Za-z0-9])\s+(?=[A-Za-z0-9])/g, '')
        : line.trimEnd()
    )
    .join('\n');
}

function filenameLoadId(filename: string): string | undefined {
  for (const { pat, prefix } of FILENAME_ID_PATTERNS) {
    if (prefix && !pat.source.includes('(')) {
      if (pat.test(filename)) return prefix.toUpperCase();
    }
    const m = filename.match(pat);
    if (m?.[1]) {
      let val = m[1].toUpperCase();
      if (prefix && !val.startsWith(prefix)) val = `${prefix}${val}`;
      return val;
    }
  }
  return undefined;
}

function sanitizeAddress(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}

function titleCaseWords(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function toIsoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const slash = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slash) {
    const month = slash[1].padStart(2, '0');
    const day = slash[2].padStart(2, '0');
    let year = slash[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const named = raw.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (named) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const month = months[named[1].slice(0, 3).toLowerCase()];
    return `${named[3]}-${month}-${named[2].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return undefined;
}

function parseEquipment(text: string): EquipmentType | undefined {
  if (/reefer|refrigerated/i.test(text)) return 'Reefer';
  if (/flatbed|step\s*deck/i.test(text)) return 'Flatbed';
  if (/dry\s*van|\bvan\b/i.test(text)) return 'Dry Van';
  return undefined;
}

function isLikelyPodContent(text: string, fileName: string): boolean {
  const lower = `${text}\n${fileName}`.toLowerCase();
  const isRateCon =
    /rate confirmation|load confirmation|load tender|carrier rate|agreed rate|total carrier pay/i.test(lower);
  if (isRateCon) return false;
  return (
    /\bproof of delivery\b/.test(lower)
    || /\breceived by\b/.test(lower)
    || /\bconsignee signature\b/.test(lower)
    || (/^\s*camscanner/i.test(fileName) && /delivered|signature|pod/i.test(lower))
  );
}

function parseLoadId(text: string, filename: string): string {
  const fnameId = filenameLoadId(filename);
  if (
    fnameId
    && (fnameId.startsWith('AT41M')
      || fnameId.startsWith('LD')
      || fnameId.startsWith('EL')
      || fnameId.startsWith('VP')
      || /^\d{5,}$/.test(fnameId))
  ) {
    return normalizeLoadId(fnameId);
  }

  const patterns: Array<{ pat: RegExp; prefix?: string }> = [
    { pat: /Load Number:\s*([A-Z0-9-]+)/i },
    { pat: /RATE CONFIRMATION #\s*(AT41M\d+)/i },
    { pat: /Reference:\s*(\d+)\s*\(BOL\)/i },
    { pat: /Load\s*#\s*(\d+)/i },
    { pat: /LOAD#\s*(\d+)/i },
    { pat: /Order\s*#?:?\s*(\d+)/i },
    { pat: /Turvo Shipment #\s*(\d+)/i },
    { pat: /SHIPMENT\s+(\d+)/i },
    { pat: /Trip\s*#\s*(\d+)/i },
    { pat: /REFERENCE ORDER NUMBER\s+(\d+)/i },
    { pat: /ORDER NUMBER\s+(\d+)/i },
    { pat: /please reference bill #(\d+)/i },
    { pat: /EL\s*#\s*(EL\d+)/i },
    { pat: /AT41M(\d+)/i, prefix: 'AT41M' },
  ];

  for (const { pat, prefix } of patterns) {
    const m = text.match(pat);
    if (!m?.[1]) continue;
    let val = m[1].trim();
    if (prefix && !val.toUpperCase().startsWith(prefix)) val = `${prefix}${val}`;
    if (/^\d{1,2}$/.test(val)) continue;
    return normalizeLoadId(val);
  }

  if (fnameId) return normalizeLoadId(fnameId);
  return normalizeLoadId(filename.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)$/, ''));
}

function parseBroker(text: string): string {
  for (const { pat, name } of BROKER_PATTERNS) {
    if (pat.test(text)) return name;
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const ln of lines.slice(0, 8)) {
    if (/rate confirmation|load confirmation|load tender|load agreement/i.test(ln)) {
      const cleaned = ln
        .replace(/\s*(rate confirmation|load confirmation|load tender|load agreement).*$/i, '')
        .trim();
      return cleaned || ln;
    }
    if (/LLC|Inc\.|Corp|Logistics|Freight|Transport/i.test(ln) && ln.length < 80) return ln;
  }
  return 'Unknown';
}

function cleanCityState(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/\s+\d{5}.*$/, '').trim();
}

function isValidCityState(raw: string | undefined): boolean {
  if (!raw) return false;
  const cleaned = cleanCityState(raw);
  const match = cleaned.match(/^(.+),\s*([A-Z]{2})$/i);
  if (!match) return false;
  const city = match[1].trim();
  const state = match[2].toUpperCase();
  if (!US_STATE_CODES.has(state) || city.length < 3) return false;
  if (/\d| st\.? | blvd| rd | ave |street|distribution| dr /i.test(city)) return false;
  return true;
}

function normalizeLaneCity(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = cleanCityState(raw);
  if (isValidCityState(cleaned)) return cleaned;
  const match = cleaned.match(/([A-Za-z][A-Za-z .'-]{2,},\s*[A-Z]{2})\s*$/);
  if (match && isValidCityState(match[1])) return cleanCityState(match[1]);
  return undefined;
}

function parseShipperReceiverStops(text: string): RateConStop[] {
  const stops: RateConStop[] = [];
  const shipperBlock = text.match(
    /Shippers?\s*\n([\s\S]*?)(?=\nReceivers?\b|\nConsignees?\b|\nNotes\b|\nTerms\b|$)/i
  );
  const receiverBlock = text.match(
    /Receivers?\s*\n([\s\S]*?)(?=\nShippers?\b|\nNotes\b|\nTerms\b|\nRates\b|$)/i
  )
    || text.match(/Consignees?\s*\n([\s\S]*?)(?=\nShippers?\b|\nNotes\b|\nTerms\b|$)/i);

  const parseBlock = (block: string | undefined, type: 'pickup' | 'dropoff', sequence: number) => {
    if (!block) return;
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    let street: string | undefined;
    let cityLine: string | undefined;
    for (const line of lines.slice(0, 10)) {
      if (/arrive by|earliest|latest|contact|phone|^us$/i.test(line) && line.length < 40) continue;
      if (/\b(inc|llc|corp|ltd|co)\.?\s*$/i.test(line)) continue;
      if (/\d/.test(line) && /(st|street|ave|blvd|rd|way|dr|hwy|road|ln|ct)\b/i.test(line) && !/,\s*[A-Z]{2}\b/.test(line)) {
        street = line;
        continue;
      }
      const city = line.match(/^([A-Za-z .'-]+?)\s*,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i);
      if (city && US_STATE_CODES.has(city[2].toUpperCase())) {
        cityLine = `${city[1].trim()}, ${city[2].toUpperCase()} ${city[3]}`;
        break;
      }
    }
    if (street && cityLine) {
      stops.push({ type, address: sanitizeAddress(`${street}, ${cityLine}`), sequence });
    } else if (cityLine) {
      stops.push({ type, address: sanitizeAddress(cityLine), sequence });
    }
  };

  parseBlock(shipperBlock?.[1], 'pickup', 0);
  parseBlock(receiverBlock?.[1], 'dropoff', 0);
  return stops;
}

function parsePriority1Stops(text: string): RateConStop[] {
  const stops: RateConStop[] = [];
  const blocks = [...text.matchAll(/Stop\s+(\d+)\s+(Pick|Drop)([\s\S]{0,500}?)(?=Stop\s+\d+\s+(?:Pick|Drop)|Freight Terms|References|$)/gi)];

  for (const block of blocks) {
    const kind = block[2].toLowerCase().startsWith('pick') ? 'pickup' : 'dropoff';
    const body = block[3];
    const cityMatch = body.match(/([A-Za-z .'-]+,\s*[A-Z]{2}\s*\d{5})/);
    if (!cityMatch) continue;
    const city = cityMatch[1].replace(/\s+/g, ' ').trim();
    const beforeCity = body.slice(0, cityMatch.index).replace(/\s+/g, ' ').trim();
    const streetMatch = beforeCity.match(
      /(\d+[A-Za-z0-9 .#'-]*\b(?:st|street|ave|blvd|rd|way|dr|hwy|road|ln|ct)\b\.?)\s*$/i
    );
    const street = streetMatch?.[1]?.trim();
    const seq = kind === 'pickup'
      ? stops.filter((s) => s.type === 'pickup').length
      : stops.filter((s) => s.type === 'dropoff').length;
    stops.push({
      type: kind,
      address: sanitizeAddress(street ? `${street}, ${city}` : city),
      sequence: seq,
    });
  }
  return stops;
}

function parseAllysStops(text: string): RateConStop[] {
  const stops: RateConStop[] = [];
  const blocks = [...text.matchAll(/STOP\s*\n?\s*0?(\d+)\s*\n([\s\S]*?)(?=\nSTOP\s*\n|\nTERMS AND CONDITIONS|\nFinancials|$)/gi)];
  for (const block of blocks) {
    const index = Number(block[1]) - 1;
    const body = block[2];
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const cityLine = lines.find((l) => /,\s*[A-Z]{2}(?:,\s*US)?\s+\d{5}/i.test(l));
    const street = lines.find((l) => /\d/.test(l) && /(st|street|ave|blvd|rd|way|dr|hwy|road|ln|ct|gate)\b/i.test(l));
    if (!cityLine) continue;
    const city = cityLine
      .replace(/,\s*US\b/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const isDelivery = /TOTAL DELIVERY|DELIVERY\s*$/i.test(body) || /REQ\. TIME:[\s\S]*DELIVERY/i.test(body)
      || index > 0;
    const type: RateConStop['type'] = isDelivery && index > 0 ? 'dropoff' : index === 0 ? 'pickup' : 'dropoff';
    const seq = type === 'pickup'
      ? stops.filter((s) => s.type === 'pickup').length
      : stops.filter((s) => s.type === 'dropoff').length;
    stops.push({
      type,
      address: sanitizeAddress(street ? `${street}, ${city}` : city),
      sequence: seq,
    });
  }
  return stops;
}

/**
 * ATN / Brown style: PICK N / STOP N with CITY ST ZIP (no comma).
 */
function parseAtnStops(text: string): RateConStop[] {
  if (!/\bPICK\s+\d/i.test(text) || !/\bSTOP\s+\d/i.test(text)) return [];

  const stops: RateConStop[] = [];
  const blocks = [
    ...text.matchAll(
      /\b(PICK|STOP)\s+(\d+)\s*\n([\s\S]*?)(?=\n(?:PICK|STOP|DEL)\s+\d|\nCARRIER MUST|\nTERMS AND CONDITIONS|$)/gi
    ),
  ];

  for (const block of blocks) {
    const kind = block[1].toUpperCase() === 'PICK' ? 'pickup' : 'dropoff';
    const body = block[3];
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^(pieces|weight|ref\s*#|appt notes)/i.test(l));

    let cityLine: string | undefined;
    let street: string | undefined;

    for (const line of lines.slice(0, 8)) {
      const cityMatch = line.match(/^([A-Z][A-Z\s'.-]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
      if (cityMatch && US_STATE_CODES.has(cityMatch[2])) {
        const city = titleCaseWords(cityMatch[1].trim());
        cityLine = `${city}, ${cityMatch[2]} ${cityMatch[3]}`;
        break;
      }
    }

    for (const line of lines.slice(0, 6)) {
      const cleaned = line.replace(/\s+Appointment\b.*$/i, '').trim();
      if (!cleaned || cleaned === cityLine) continue;
      if (/appt notes|pieces|weight|ref\s*#/i.test(cleaned)) continue;
      if (
        /\d/.test(cleaned)
        && /(st|street|ave|blvd|rd|way|dr|hwy|road|ln|ct|cir|circle|blvd)\b/i.test(cleaned)
      ) {
        street = cleaned;
        break;
      }
    }

    if (!cityLine) continue;
    const parts = [street, cityLine].filter(Boolean);
    const seq = kind === 'pickup'
      ? stops.filter((s) => s.type === 'pickup').length
      : stops.filter((s) => s.type === 'dropoff').length;
    stops.push({ type: kind, address: sanitizeAddress(parts.join(', ')), sequence: seq });
  }

  return stops;
}

/**
 * BM2 style: Shipper Pickup (Stop N) / Consignee Delivery (Stop N) with City, ST US ZIP.
 */
function parseBm2Stops(text: string): RateConStop[] {
  if (!/Shipper Pickup\s*\(Stop/i.test(text) && !/Consignee Delivery\s*\(Stop/i.test(text)) {
    return [];
  }

  const stops: RateConStop[] = [];
  const blocks = [
    ...text.matchAll(
      /(Shipper Pickup|Consignee Delivery)\s*\(Stop\s*\d+\)\s*\n([\s\S]*?)(?=\n(?:Shipper Pickup|Consignee Delivery)\s*\(Stop|\nShipment Information|\nCarrier Fees|$)/gi
    ),
  ];

  for (const block of blocks) {
    const kind = /pickup/i.test(block[1]) ? 'pickup' : 'dropoff';
    const body = block[2];
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter(
        (l) =>
          !/^(expected date|shipping\/receiving|appointment|pickup instructions|delivery instructions|shipper references|consignee references|pickup\/delivery number)/i.test(
            l
          )
      );

    let street: string | undefined;
    let cityLine: string | undefined;

    for (const line of lines.slice(0, 8)) {
      const cityMatch = line.match(
        /^([A-Za-z .'-]+?)\s*,\s*([A-Z]{2})(?:\s+US)?\s+(\d{5}(?:-\d{4})?)\b/i
      );
      if (cityMatch && US_STATE_CODES.has(cityMatch[2].toUpperCase())) {
        cityLine = `${cityMatch[1].trim()}, ${cityMatch[2].toUpperCase()} ${cityMatch[3]}`;
        continue;
      }
      if (
        /\d/.test(line)
        && /(st|street|ave|blvd|rd|way|dr|hwy|road|ln|ct|boulevard|ave)\b/i.test(line)
        && !cityLine
      ) {
        street = line;
        continue;
      }
    }

    if (!cityLine) continue;
    const parts = [street, cityLine].filter(Boolean);
    const seq = kind === 'pickup'
      ? stops.filter((s) => s.type === 'pickup').length
      : stops.filter((s) => s.type === 'dropoff').length;
    stops.push({ type: kind, address: sanitizeAddress(parts.join(', ')), sequence: seq });
  }

  return stops;
}

function parseLaneFallbackStops(text: string): RateConStop[] {
  let pickups: string[] = [];
  let drops: string[] = [];

  pickups = [...text.matchAll(/Stop\s+\d+\s+Pick[^\n]{0,250}?([A-Za-z .'-]+,\s*[A-Z]{2})\s*\d{5}/gi)]
    .map((m) => m[1]);
  drops = [...text.matchAll(/Stop\s+\d+\s+Drop[^\n]{0,250}?([A-Za-z .'-]+,\s*[A-Z]{2})\s*\d{5}/gi)]
    .map((m) => m[1]);

  if (!pickups.length) {
    const m = text.match(/Origin:?\s*([A-Za-z .'-]+,\s*[A-Z]{2})/i);
    if (m) pickups = [m[1]];
  }
  if (!drops.length) {
    const m = text.match(/Destination:?\s*([A-Za-z .'-]+,\s*[A-Z]{2})/i);
    if (m) drops = [m[1]];
  }

  const origin = normalizeLaneCity(pickups[0]);
  const destination = normalizeLaneCity(drops[drops.length - 1]);
  const stops: RateConStop[] = [];
  if (origin) stops.push({ type: 'pickup', address: origin, sequence: 0 });
  if (destination) stops.push({ type: 'dropoff', address: destination, sequence: 0 });
  return stops;
}

function parseStops(text: string): RateConStop[] {
  const shipperStops = parseShipperReceiverStops(text);
  if (shipperStops.some((s) => s.type === 'pickup') && shipperStops.some((s) => s.type === 'dropoff')) {
    return shipperStops;
  }

  const p1 = parsePriority1Stops(text);
  if (p1.some((s) => s.type === 'pickup') && p1.some((s) => s.type === 'dropoff')) {
    return p1;
  }

  const allys = parseAllysStops(text);
  if (allys.some((s) => s.type === 'pickup') && allys.some((s) => s.type === 'dropoff')) {
    return allys;
  }

  const atn = parseAtnStops(text);
  if (atn.some((s) => s.type === 'pickup') && atn.some((s) => s.type === 'dropoff')) {
    return atn;
  }

  const bm2 = parseBm2Stops(text);
  if (bm2.some((s) => s.type === 'pickup') && bm2.some((s) => s.type === 'dropoff')) {
    return bm2;
  }

  return parseLaneFallbackStops(text);
}

function parseMiles(text: string): number | undefined {
  const labeled = [
    /Carrier Miles\s*\n\s*([\d,]+(?:\.\d+)?)/i,
    /Total\s+Miles?:?\s*([\d,]+(?:\.\d+)?)/i,
    /Loaded\s+Miles?:?\s*([\d,]+(?:\.\d+)?)/i,
    /Trip\s+Miles?:?\s*([\d,]+(?:\.\d+)?)/i,
    /Distance\s*\(\s*Miles\s*\):?\s*([\d,]+(?:\.\d+)?)/i,
    /Distance:?\s*([\d,]+(?:\.\d+)?)\s*(?:mi|miles)?/i,
    /Mileage:?\s*([\d,]+(?:\.\d+)?)/i,
    /Bill\s+Miles?:?\s*([\d,]+(?:\.\d+)?)/i,
  ];
  for (const pat of labeled) {
    const m = text.match(pat);
    const val = m ? parseMoney(m[1]) : undefined;
    if (val != null && val >= 100 && val <= 4000) return Math.round(val);
  }

  // ATN header: Miles: then size/desc line ending with miles value
  const atnMiles = text.match(
    /Miles:\s*\n(?:Pieces:\s*Weight:\s*\n)?[^\n]*?\s(\d{3,4})\s*(?:\n|$)/i
  );
  if (atnMiles) {
    const val = parseMoney(atnMiles[1]);
    if (val != null && val >= 100 && val <= 4000) return Math.round(val);
  }

  for (const m of text.matchAll(/\b([\d,]{3,4})\s*miles?\b/gi)) {
    const before = text.slice(Math.max(0, m.index! - 40), m.index!).toLowerCase();
    if (/(minimum|weight|limit|radius|within|per mile|return)/.test(before)) continue;
    const val = parseMoney(m[1]);
    if (val != null && val >= 100 && val <= 4000) return Math.round(val);
  }
  return undefined;
}

function formatWeightLbs(raw: string): string | undefined {
  const val = parseMoney(raw);
  if (val == null || val < 500 || val > 90000) return undefined;
  return `${Math.round(val)} lbs`;
}

/**
 * Shipment weight from rate cons when explicitly printed.
 */
function parseWeight(text: string): string | undefined {
  const labeled = [
    /Total\s+Weight:?\s*([\d,]+(?:\.\d+)?)\s*(?:lb|lbs|pounds)?/i,
    /TOTAL\s+PICKUP\s*\n\s*([\d,]+(?:\.\d+)?)\s*lbs/i,
    /TOTAL\s+DELIVERY\s*\n\s*([\d,]+(?:\.\d+)?)\s*lbs/i,
    /Shipment\s*\n\s*([\d,]+(?:\.\d+)?)\s*lbs(?:\s*\([^)]*\))?/i,
    /Gross\s+Weight:?\s*([\d,]+(?:\.\d+)?)\s*(?:lb|lbs)?/i,
    /Weight:?\s*([\d,]+(?:\.\d+)?)\s*(?:lb|lbs|pounds)\b/i,
    /\b([\d,]+(?:\.\d+)?)\s*lbs?\s*\(\s*[\d.]+\s*tons?\s*\)/i,
  ];
  for (const pat of labeled) {
    const m = text.match(pat);
    if (!m?.[1]) continue;
    const formatted = formatWeightLbs(m[1]);
    if (formatted) return formatted;
  }

  // Bare "Weight: N" (ATN) — skip tiny false hits like "Weight:\n53' VAN"
  for (const m of text.matchAll(/Weight:?\s*([\d,]{4,6}(?:\.\d+)?)\b/gi)) {
    const formatted = formatWeightLbs(m[1]);
    if (formatted) return formatted;
  }

  // Fallback: first standalone "N lbs" in a freight-ish range (not hours/detention)
  for (const m of text.matchAll(/\b([\d,]{4,6}(?:\.\d+)?)\s*lbs?\b/gi)) {
    const before = text.slice(Math.max(0, m.index! - 30), m.index!).toLowerCase();
    if (/(per|min|hour|detention|rate|\$)/.test(before)) continue;
    const formatted = formatWeightLbs(m[1]);
    if (formatted) return formatted;
  }
  return undefined;
}

function parseDates(text: string): { pickupDate?: string; deliveryDate?: string } {
  const appointments = [...text.matchAll(/Appointment\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi)].map(
    (m) => m[1]
  );
  const expectedDates = [...text.matchAll(/Expected Date:\s*([\d/]+)/gi)].map((m) => m[1]);

  const pickup =
    text.match(/Pickup Date\s*&\s*Time:\s*([\d/]+)/i)?.[1]
    || text.match(/Ship Date:\s*([\d/]+)/i)?.[1]
    || text.match(/PU Date:\s*([\d/]+)/i)?.[1]
    || text.match(/Earliest\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1]
    || text.match(/REQ\.?\s*TIME:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i)?.[1]
    || text.match(/Stop\s+1\s+Pick\s*\n([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i)?.[1]
    || appointments[0]
    || expectedDates[0];

  const deliveryMatches = [...text.matchAll(/Earliest\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi)].map((m) => m[1]);
  const delivery =
    text.match(/Delivery Date\s*&\s*Time:\s*([\d/]+)/i)?.[1]
    || text.match(/Delivery Date:\s*([\d/]+)/i)?.[1]
    || deliveryMatches[1]
    || text.match(/REQ\.?\s*TIME:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})[\s\S]{0,80}?DELIVERY/i)?.[1]
    || [...text.matchAll(/REQ\.?\s*TIME:\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/gi)].map((m) => m[1])[1]
    || appointments[1]
    || expectedDates[1];

  return {
    pickupDate: toIsoDate(pickup),
    deliveryDate: toIsoDate(delivery),
  };
}

function saneAmount(val: number | undefined): number | undefined {
  if (val == null || val < 50 || val > 50000) return undefined;
  return val;
}

function findAmountAfterLabel(
  text: string,
  label: string,
  options: { min?: number; max?: number } = {}
): number | undefined {
  const min = options.min ?? 50;
  const max = options.max ?? 50000;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = [
    text.match(new RegExp(`${escaped}\\s*[^\\d\\n]{0,20}\\n\\s*([\\d,]+(?:\\.\\d{2})?)`, 'i')),
    text.match(new RegExp(`${escaped}\\s[^\\d\\n]{0,30}([\\d,]+(?:\\.\\d{2})?)`, 'i')),
  ];
  for (const m of candidates) {
    const val = m ? parseMoney(m[1]) : undefined;
    if (val != null && val >= min && val <= max) return val;
  }
  return undefined;
}

function parseAtnAmounts(text: string): {
  lineHaul?: number;
  accessorials?: number;
  accessorialDetail: string;
  payout?: number;
} | null {
  if (!/LINE HAUL RATE/i.test(text) || !/TOTAL RATE/i.test(text)) return null;

  const lineHaul = findAmountAfterLabel(text, 'LINE HAUL RATE');
  const detention = findAmountAfterLabel(text, 'DETENTION LOADING', { min: 1, max: 5000 });
  let payout = findAmountAfterLabel(text, 'TOTAL RATE');
  if (payout == null && lineHaul != null) {
    payout = saneAmount(Math.round((lineHaul + (detention || 0)) * 100) / 100);
  }

  return {
    lineHaul,
    accessorials: detention,
    accessorialDetail: detention ? `Detention loading $${detention.toFixed(2)}` : '',
    payout,
  };
}

function parseAmounts(text: string): {
  lineHaul?: number;
  accessorials?: number;
  accessorialDetail: string;
  payout?: number;
} {
  const atn = parseAtnAmounts(text);
  if (atn?.payout != null) return atn;

  let lineHaul: number | undefined;
  let accessorials: number | undefined;
  let accessorialDetail = '';
  let payout: number | undefined;

  const totalPatterns = [
    /\*\*\s*TOTAL RATE:\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /AGREED RATE\s+([\d,]+(?:\.\d{2})?)\s*USD/i,
    /Total Due \(USD\):\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /Total Pay:\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /Total Carrier Pay:?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /TOTAL AGREED CHARGES\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /TOTAL RATE:\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /TOTAL RATE\s[^\d\n]{0,30}([\d,]+(?:\.\d{2})?)/i,
    /Total Cost\s*USD\s+([\d,]+(?:\.\d{2})?)/i,
    /Total Cost\s*\n?\s*USD\s+([\d,]+(?:\.\d{2})?)/i,
    /Net Freight Charges\s*USD\s+([\d,]+(?:\.\d{2})?)/i,
    /^\s*TOTAL\s*\n\s*\$?([\d,]+(?:\.\d{2})?)/im,
    /Total:\s*\$([\d,]+(?:\.\d{2})?)/i,
    /Freight Terms:\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*USD/i,
    /BASE AMOUNT[\s\S]{0,40}?\$([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pat of totalPatterns) {
    const m = text.match(pat);
    payout = saneAmount(m ? parseMoney(m[1]) : undefined);
    if (payout != null) break;
  }

  const lhPatterns = [
    /Partner Freight\s+\d+\s+([\d,]+(?:\.\d{2})?)\s*USD/i,
    /Line Haul\s+([\d,]+(?:\.\d{2})?)\s+Flat Rate/i,
    /Line Haul\s*\n\s*([\d,]+(?:\.\d{2})?)/i,
    /LINE HAUL RATE\s[^\d\n]{0,20}([\d,]+(?:\.\d{2})?)/i,
    /Line Haul\s+([\d,]+(?:\.\d{2})?)/i,
    /Freight charge\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /Net Freight Charges\s*USD\s+([\d,]+(?:\.\d{2})?)/i,
    /BASE RATE:\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    /Base\s*\nAmount\s*\n1\s*\n\$([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pat of lhPatterns) {
    const m = text.match(pat);
    lineHaul = saneAmount(m ? parseMoney(m[1]) : undefined);
    if (lineHaul != null) break;
  }

  const accItems: Array<[string, number]> = [];
  const accPatterns: Array<{ pat: RegExp; label: string }> = [
    { pat: /MacroPoint Tracking\s+\d+\s+([\d,]+(?:\.\d{2})?)\s*USD/i, label: 'MacroPoint Tracking' },
    { pat: /Stop Off\s+([\d,]+(?:\.\d{2})?)/i, label: 'Stop Off' },
    { pat: /Fuel Surcharge[^\n]*?([\d,]+(?:\.\d{2})?)/i, label: 'Fuel Surcharge' },
    { pat: /DETENTION LOADING\s[^\d$]{0,20}([\d,]+(?:\.\d{2})?)/i, label: 'Detention loading' },
  ];
  for (const { pat, label } of accPatterns) {
    const m = text.match(pat);
    const val = saneAmount(m ? parseMoney(m[1]) : undefined);
    if (val && (lineHaul == null || Math.abs(val - lineHaul) > 0.01) && (payout == null || val < payout)) {
      accItems.push([label, val]);
    }
  }
  if (accItems.length) {
    accessorialDetail = accItems.map(([lbl, v]) => `${lbl} $${v.toFixed(2)}`).join('; ');
    accessorials = Math.round(accItems.reduce((sum, [, v]) => sum + v, 0) * 100) / 100;
  }

  if (payout == null) {
    const m = text.match(/Charge Details[\s\S]{0,800}?Total:\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    payout = saneAmount(m ? parseMoney(m[1]) : undefined);
  }

  if (payout == null && lineHaul != null) {
    payout = saneAmount(Math.round((lineHaul + (accessorials || 0)) * 100) / 100);
  }

  if (payout != null && lineHaul != null && accessorials == null && payout > lineHaul) {
    accessorials = Math.round((payout - lineHaul) * 100) / 100;
    if (accessorials > 0 && !accessorialDetail) {
      accessorialDetail = `Included in total $${accessorials.toFixed(2)}`;
    }
  }

  return { lineHaul, accessorials, accessorialDetail, payout };
}

/**
 * Free, deterministic rate-confirmation parser.
 * Works on OCR or digital PDF text — no cloud AI required.
 */
export function parseRateConfirmation(
  rawText: string,
  fileName: string = 'rate-confirmation.pdf'
): ParseRateConfirmationResult {
  const text = normalizeSpacedText(rawText || '');
  const warnings: string[] = [];

  if (isLikelyPodContent(text, fileName)) {
    return {
      documentType: 'proof_of_delivery',
      draft: null,
      rawText: text,
      confidence: 0.4,
    };
  }

  let documentType = normalizeDocumentType(undefined, text, fileName);
  if (
    /rate confirmation|load confirmation|load tender|carrier rate|agreed rate/i.test(text)
    || /Carrier_Rate_Confirmation|Rate-Confirmation|RateConfirmation/i.test(fileName)
  ) {
    documentType = 'rate_confirmation';
  }

  if (documentType !== 'rate_confirmation') {
    return {
      documentType,
      draft: null,
      rawText: text,
      confidence: text.length > 80 ? 0.55 : 0.3,
    };
  }

  if (text.trim().length < 80) {
    warnings.push('Sparse text — OCR or manual review may be required.');
    return {
      documentType,
      draft: {
        sourceFile: fileName,
        loadRef: filenameLoadId(fileName),
        stops: [],
        warnings,
        confidence: 0.35,
      },
      rawText: text,
      confidence: 0.35,
    };
  }

  const amounts = parseAmounts(text);
  const dates = parseDates(text);
  const stops = parseStops(text);
  const miles = parseMiles(text);
  const weight = parseWeight(text);
  const broker = parseBroker(text);
  const loadRef = parseLoadId(text, fileName);

  if (!amounts.payout) warnings.push('Could not parse gross pay — needs review.');
  if (!stops.some((s) => s.type === 'pickup') || !stops.some((s) => s.type === 'dropoff')) {
    warnings.push('Could not parse full pickup/dropoff stops — needs review.');
  }

  const draft: RateConDraft = {
    sourceFile: fileName,
    loadRef,
    broker: broker === 'Unknown' ? undefined : broker,
    payout: moneyString(amounts.payout),
    lineHaul: moneyString(amounts.lineHaul),
    accessorials: moneyString(amounts.accessorials),
    accessorialDetail: amounts.accessorialDetail || undefined,
    miles: miles != null ? String(miles) : undefined,
    milesSource: miles != null ? 'rate_con' : undefined,
    type: parseEquipment(text),
    pickupDate: dates.pickupDate,
    deliveryDate: dates.deliveryDate,
    weight,
    stops: stops.map((stop) => ({
      ...stop,
      address: normalizeStopAddress(stop.address),
    })),
    confidence: warnings.length ? 0.7 : 0.9,
    warnings,
  };

  return {
    documentType,
    draft,
    rawText: text,
    confidence: draft.confidence || 0.8,
  };
}
