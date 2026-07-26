import * as fs from 'fs';
import * as path from 'path';
import { parseRateConfirmation } from '../utils/rateConParser';

function readFixture(name: string): string {
  return fs.readFileSync(
    path.join(__dirname, 'fixtures', name),
    'utf8'
  );
}

describe('parseRateConfirmation', () => {
  it('parses Corporate Traffic load confirmation with full addresses', () => {
    const text = readFixture('1_5066584670674618081.txt');
    const result = parseRateConfirmation(text, '1_5066584670674618081.pdf');
    expect(result.documentType).toBe('rate_confirmation');
    expect(result.draft?.loadRef).toBe('11657576');
    expect(result.draft?.broker).toBe('Corporate Traffic');
    expect(result.draft?.payout).toBe('1100');
    expect(result.draft?.type).toBe('Dry Van');
    expect(result.draft?.weight).toBe('8750 lbs');
    expect(result.draft?.stops.some((s) => s.type === 'pickup' && /MESQUITE.*NV/i.test(s.address))).toBe(true);
    expect(result.draft?.stops.some((s) => s.type === 'dropoff' && /RIALTO.*CA/i.test(s.address))).toBe(true);
  });

  it('parses Priority 1 multi-drop rate confirmation', () => {
    const text = readFixture('Carrier_Rate_Confirmation_60114154252.txt');
    const result = parseRateConfirmation(text, 'Carrier_Rate_Confirmation_60114154252.pdf');
    expect(result.documentType).toBe('rate_confirmation');
    expect(result.draft?.loadRef).toBe('60114154252');
    expect(result.draft?.broker).toBe('Priority 1');
    expect(result.draft?.payout).toBe('7100');
    expect(result.draft?.lineHaul).toBe('7050');
    expect(result.draft?.accessorials).toBe('50');
    expect(result.draft?.weight).toBe('35000 lbs');
    const dropoffs = result.draft?.stops.filter((s) => s.type === 'dropoff') || [];
    expect(dropoffs.length).toBeGreaterThanOrEqual(2);
    expect(result.draft?.stops.some((s) => s.type === 'pickup' && /Commerce,\s*CA/i.test(s.address))).toBe(true);
  });

  it('parses Allys Transportation rate confirmation', () => {
    const text = readFixture('AT41M2619-Rate-Confirmation.txt');
    const result = parseRateConfirmation(text, 'AT41M2619-Rate-Confirmation.pdf');
    expect(result.documentType).toBe('rate_confirmation');
    expect(result.draft?.loadRef).toBe('AT41M2619');
    expect(result.draft?.broker).toBe('Allys Transportation');
    expect(result.draft?.payout).toBe('6200');
    expect(result.draft?.lineHaul).toBe('5950');
    expect(result.draft?.stops.some((s) => s.type === 'pickup')).toBe(true);
    expect(result.draft?.stops.some((s) => s.type === 'dropoff')).toBe(true);
  });

  it('parses ATN rate confirmation with PICK/STOP blocks', () => {
    const text = readFixture('108648.txt');
    const result = parseRateConfirmation(text, '108648.pdf');
    expect(result.documentType).toBe('rate_confirmation');
    expect(result.draft?.loadRef).toBe('108648');
    expect(result.draft?.broker).toBe('ATN');
    expect(result.draft?.payout).toBe('3735');
    expect(result.draft?.lineHaul).toBe('3700');
    expect(result.draft?.accessorials).toBe('35');
    expect(result.draft?.miles).toBe('2107');
    expect(result.draft?.weight).toBe('41600 lbs');
    expect(result.draft?.pickupDate).toBe('2026-02-02');
    expect(result.draft?.deliveryDate).toBe('2026-02-06');
    expect(result.draft?.stops.some((s) => s.type === 'pickup' && /Taylors,\s*SC/i.test(s.address))).toBe(true);
    expect(
      result.draft?.stops.some((s) => s.type === 'dropoff' && /North Las Vegas,\s*NV/i.test(s.address))
    ).toBe(true);
    expect(result.draft?.warnings || []).toEqual([]);
  });

  it('parses BM2 Freight rate confirmation with Shipper/Consignee stops', () => {
    const text = readFixture('605201_BM2.txt');
    const result = parseRateConfirmation(
      text,
      '605201_MC123734_SPRINTERSTATE_LLC_Carrier_Rate_and_Load_Confirmation.pdf'
    );
    expect(result.documentType).toBe('rate_confirmation');
    expect(result.draft?.loadRef).toBe('605201');
    expect(result.draft?.broker).toBe('BM2 Freight');
    expect(result.draft?.payout).toBe('4300');
    expect(result.draft?.miles).toBe('2531');
    expect(result.draft?.weight).toBe('10000 lbs');
    expect(result.draft?.pickupDate).toBe('2026-02-21');
    expect(result.draft?.deliveryDate).toBe('2026-02-25');
    expect(result.draft?.stops.some((s) => s.type === 'pickup' && /Charlotte,\s*NC/i.test(s.address))).toBe(true);
    expect(result.draft?.stops.some((s) => s.type === 'dropoff' && /Fresno,\s*CA/i.test(s.address))).toBe(true);
    expect(result.draft?.stops.some((s) => /Covington/i.test(s.address))).toBe(false);
    expect(result.draft?.warnings || []).toEqual([]);
  });

  it('rejects clear POD content', () => {
    const result = parseRateConfirmation(
      'PROOF OF DELIVERY\nReceived By: John\nConsignee Signature: X',
      'pod.pdf'
    );
    expect(result.documentType).toBe('proof_of_delivery');
    expect(result.draft).toBeNull();
  });
});
