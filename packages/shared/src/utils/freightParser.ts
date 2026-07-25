import type { DocumentType, ExtractedDocData } from '../types';

export function normalizeDocumentType(
  rawType?: string,
  rawText?: string,
  fileName?: string
): DocumentType {
  const text = `${rawType || ''} ${rawText || ''} ${fileName || ''}`.toLowerCase();

  // 1. Bill of Lading (BOL) Keywords
  if (
    text.includes('bill of lading') ||
    text.includes('straight bill') ||
    text.includes('lading') ||
    text.includes('bol #') ||
    text.includes('b/l #') ||
    text.includes('bol:') ||
    text.includes('b/l:') ||
    text.includes('shipper') ||
    text.includes('consignee') ||
    text.includes('freight bill')
  ) {
    return 'bill_of_lading';
  }

  // 2. Rate Confirmation Keywords
  if (
    text.includes('rate confirmation') ||
    text.includes('rate conf') ||
    text.includes('load confirmation') ||
    text.includes('rate lock') ||
    text.includes('linehaul') ||
    text.includes('carrier pay')
  ) {
    return 'rate_confirmation';
  }

  // 3. Proof of Delivery (POD) Keywords
  if (
    text.includes('proof of delivery') ||
    text.includes('pod') ||
    text.includes('delivery receipt') ||
    text.includes('received in good order') ||
    text.includes('consignee signature') ||
    text.includes('delivered date')
  ) {
    return 'proof_of_delivery';
  }

  // 4. Scale Tickets & Receipts Keywords
  if (
    text.includes('cat scale') ||
    text.includes('weight ticket') ||
    text.includes('scale ticket') ||
    text.includes('gross') ||
    text.includes('tare') ||
    text.includes('fuel receipt') ||
    text.includes('lumper')
  ) {
    return 'receipt';
  }

  // Default to Bill of Lading for trucking document uploads
  return 'bill_of_lading';
}

/**
 * Anchor-matching Freight Parser that parses 100% REAL OCR text output.
 * ZERO random fake strings are generated!
 */
export function parseFreightText(
  rawText: string = '',
  fileName: string = ''
): ExtractedDocData {
  const text = rawText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const docType = normalizeDocumentType(undefined, text, fileName);
  let bolNumber: string | undefined = undefined;
  let rateConfirmationNumber: string | undefined = undefined;
  let weight: string | undefined = undefined;
  let totalRate: string | undefined = undefined;
  let shipperName: string | undefined = undefined;
  let consigneeName: string | undefined = undefined;
  let pickupDate: string | undefined = undefined;
  let deliveryDate: string | undefined = undefined;
  let handwrittenNotes: string | undefined = undefined;

  // 1. BOL Number Anchor Patterns
  const bolPatterns = [
    /(?:Bill\s*of\s*Lading\s*(?:#|NO|NUMBER|NUM|ID)?|BOL\s*(?:#|NO|NUMBER|NUM|ID)?|B\/L\s*(?:#|NO|NUMBER)?|Straight\s*Bill\s*(?:#|NO)?|Shipment\s*#)\s*[:#-]?\s*([A-Z0-9-]{3,30})/i,
    /\bBOL\s*[:#\s]*([A-Z0-9-]{3,30})\b/i,
    /\bB\/L\s*[:#\s]*([A-Z0-9-]{3,30})\b/i,
    /\b([A-Z0-9]{3,6}-\d{4,12})\b/,
  ];

  for (const pat of bolPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const val = match[1].trim();
      // Ignore generic words that aren't real numbers
      if (!['NUMBER', 'NO', 'NUM', 'DATE', 'FORM', 'PAGE', 'OF'].includes(val.toUpperCase())) {
        bolNumber = val;
        break;
      }
    }
  }

  // If no anchor prefix found, scan lines near "Bill of Lading" header
  if (!bolNumber) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/bill\s*of\s*lading|bol\b|b\/l\b/i.test(line)) {
        // Look in current line or next 2 lines for standalone number/code
        for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
          const codeMatch = lines[j].match(/\b([A-Z0-9-]{5,20})\b/);
          if (codeMatch && codeMatch[1] && !/lading|bill|straight|shipper|consignee/i.test(codeMatch[1])) {
            bolNumber = codeMatch[1].trim();
            break;
          }
        }
        if (bolNumber) break;
      }
    }
  }

  // 2. Rate Confirmation Anchor Patterns
  const rateConfPatterns = [
    /(?:Rate\s*Conf(?:irmation)?\s*(?:#|NO)?|Confirmation\s*#|Load\s*#|Agmt\s*#|Contract\s*#|Order\s*#)\s*[:#-]?\s*([A-Z0-9-]{4,25})/i,
  ];
  for (const pat of rateConfPatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const val = match[1].trim();
      if (!['NUMBER', 'NO', 'DATE'].includes(val.toUpperCase())) {
        rateConfirmationNumber = val;
        break;
      }
    }
  }

  // 3. Weight Anchor Patterns
  const weightMatch =
    text.match(/(?:Gross|Net|Weight|Total\s*Wt|Scale\s*Wt)\s*[:#\s]*([0-9,]{3,7}\s*(?:lbs|lb|kg)?)/i) ||
    text.match(/\b([0-9]{2,3},[0-9]{3})\s*(?:lbs|lb)\b/i);
  if (weightMatch && weightMatch[1]) {
    const wStr = weightMatch[1].trim();
    weight = wStr.toLowerCase().includes('lb') ? wStr : `${wStr} lbs`;
  }

  // 4. Total Rate ($) Anchor Patterns
  const rateMatch =
    text.match(/(?:Total\s*Rate|Total\s*Pay|Linehaul|Flat\s*Rate|Total\s*Amount|Payout)\s*[:#\s]*(\$\s*[0-9,]+(?:\.[0-9]{2})?)/i) ||
    text.match(/\$\s*([1-9][0-9]{2,4}(?:\.[0-9]{2})?)/);
  if (rateMatch && rateMatch[1]) {
    totalRate = rateMatch[1].startsWith('$') ? rateMatch[1] : `$${rateMatch[1]}`;
  }

  // 5. Shipper & Consignee Name Anchors
  const shipperMatch = text.match(/(?:Shipper|From|Origin|Pickup\s*At|Ship\s*From)\s*[:\s]*([^\n\r,]{3,45})/i);
  if (shipperMatch && shipperMatch[1]) {
    shipperName = shipperMatch[1].trim();
  }

  const consigneeMatch = text.match(/(?:Consignee|To|Destination|Deliver\s*To|Ship\s*To)\s*[:\s]*([^\n\r,]{3,45})/i);
  if (consigneeMatch && consigneeMatch[1]) {
    consigneeName = consigneeMatch[1].trim();
  }

  // 6. Dates
  const dateMatches = text.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g);
  if (dateMatches && dateMatches.length > 0) {
    pickupDate = dateMatches[0];
    if (dateMatches.length > 1) {
      deliveryDate = dateMatches[1];
    }
  }

  // 7. Handwritten Notes / Driver Signatures heuristic
  const noteMatch = text.match(/(?:Note|Notes|Remarks|Driver\s*Signature|Received\s*By|Instructions)\s*[:\s]*([^\n\r]{5,100})/i);
  if (noteMatch && noteMatch[1]) {
    handwrittenNotes = noteMatch[1].trim();
  }

  return {
    documentType: docType,
    bolNumber,
    rateConfirmationNumber,
    weight,
    totalRate,
    shipperName,
    consigneeName,
    pickupDate,
    deliveryDate,
    handwrittenNotes,
    rawText: text,
    confidence: text.length > 50 ? 0.92 : 0.60,
  };
}
