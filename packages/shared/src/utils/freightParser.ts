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
    text.includes('bol') ||
    text.includes('b/l') ||
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
    text.includes('broker') ||
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
    text.includes('delivered')
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
    text.includes('net weight') ||
    text.includes('fuel receipt') ||
    text.includes('lumper')
  ) {
    return 'receipt';
  }

  // Default to Bill of Lading for freight logistics documents
  return 'bill_of_lading';
}

export function parseFreightText(
  rawText: string = '',
  fileName: string = ''
): Partial<ExtractedDocData> {
  const text = rawText || '';
  const result: Partial<ExtractedDocData> = {};

  // 1. Document Type
  result.documentType = normalizeDocumentType(undefined, text, fileName);

  // 2. BOL Number Regex
  const bolMatch =
    text.match(/(?:BOL|B\/L|Bill\s*of\s*Lading|Order|Shipment|Tracking|Ref)\s*[:#\s]*([A-Z0-9-]{4,25})/i) ||
    text.match(/\b([A-Z0-9]{3,6}-\d{4,10})\b/);
  if (bolMatch && bolMatch[1]) {
    result.bolNumber = bolMatch[1].trim();
  }

  // 3. Rate Confirmation Number Regex
  const rateConfMatch =
    text.match(/(?:Rate\s*Conf|Confirmation|Load|Agmt|Contract)\s*[:#\s]*([A-Z0-9-]{4,20})/i);
  if (rateConfMatch && rateConfMatch[1]) {
    result.rateConfirmationNumber = rateConfMatch[1].trim();
  }

  // 4. Weight Extraction (lbs, lb, kg)
  const weightMatch =
    text.match(/(?:Gross|Net|Weight|Total\s*Wt)\s*[:#\s]*([0-9,]{4,7}\s*(?:lbs|lb|kg)?)/i) ||
    text.match(/\b([0-9]{2,3},[0-9]{3})\s*(?:lbs|lb)\b/i);
  if (weightMatch && weightMatch[1]) {
    const wStr = weightMatch[1].trim();
    result.weight = wStr.toLowerCase().includes('lb') ? wStr : `${wStr} lbs`;
  }

  // 5. Total Rate / Payout ($)
  const rateMatch =
    text.match(/(?:Total\s*Rate|Total\s*Pay|Linehaul|Flat\s*Rate|Amount|Total)\s*[:#\s]*(\$\s*[0-9,]+(?:\.[0-9]{2})?)/i) ||
    text.match(/\$\s*([1-9][0-9]{2,4}(?:\.[0-9]{2})?)/);
  if (rateMatch && rateMatch[1]) {
    result.totalRate = rateMatch[1].startsWith('$') ? rateMatch[1] : `$${rateMatch[1]}`;
  }

  // 6. Pickup & Delivery Dates (YYYY-MM-DD or MM/DD/YYYY)
  const dateMatches = text.match(/\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g);
  if (dateMatches && dateMatches.length > 0) {
    result.pickupDate = dateMatches[0];
    if (dateMatches.length > 1) {
      result.deliveryDate = dateMatches[1];
    }
  }

  // 7. Shipper Name heuristic
  const shipperMatch = text.match(/(?:Shipper|From|Origin|Pickup\s*At)\s*[:\s]*([^\n\r,]{3,40})/i);
  if (shipperMatch && shipperMatch[1]) {
    result.shipperName = shipperMatch[1].trim();
  }

  // 8. Consignee Name heuristic
  const consigneeMatch = text.match(/(?:Consignee|To|Destination|Deliver\s*To)\s*[:\s]*([^\n\r,]{3,40})/i);
  if (consigneeMatch && consigneeMatch[1]) {
    result.consigneeName = consigneeMatch[1].trim();
  }

  return result;
}
