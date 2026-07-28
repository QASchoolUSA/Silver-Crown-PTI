import { normalizeDocumentType, parseFreightText } from '../utils/freightParser';

const PRIORITY1_SNIPPET = `
Stop 1 Pick
Dreamway Logistics INC Commerce, CA 90040
Shipper take minimum of 4 hrs to load
Stop 2 Drop
Amazon RDU2 Smithfield, NC 27577
Line Haul 9000.00 Flat Rate $9,000.00 USD
All invoices & PODs are to be sent to Priority 1 within 72 hours of delivery.
Please email invoice and POD to: tlap@priority1.com.
Carrier Load Tender
Reference: 60115111210 (BOL)
stated on the rate confirmation.
`;

describe('normalizeDocumentType', () => {
  it('classifies Priority 1 load tender with POD invoicing language as rate confirmation', () => {
    expect(
      normalizeDocumentType(
        undefined,
        PRIORITY1_SNIPPET,
        'Carrier_Rate_Confirmation_60115111210.pdf'
      )
    ).toBe('rate_confirmation');
  });

  it('does not treat bare POD mentions as proof of delivery when rate-con signals exist', () => {
    expect(normalizeDocumentType(undefined, PRIORITY1_SNIPPET, 'rate.pdf')).toBe(
      'rate_confirmation'
    );
  });

  it('still classifies true POD documents', () => {
    expect(
      normalizeDocumentType(
        undefined,
        'PROOF OF DELIVERY\nReceived By: John\nConsignee Signature: X',
        'pod.pdf'
      )
    ).toBe('proof_of_delivery');
  });

  it('parseFreightText keeps Priority 1 as rate confirmation', () => {
    const parsed = parseFreightText(
      PRIORITY1_SNIPPET,
      'Carrier_Rate_Confirmation_60115111210.pdf'
    );
    expect(parsed.documentType).toBe('rate_confirmation');
  });
});
