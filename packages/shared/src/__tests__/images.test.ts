import { normalizeSignatureDataUrl, estimateDataUrlBytes } from '../utils/images';

describe('normalizeSignatureDataUrl', () => {
  it('adds data URL prefix when missing', () => {
    expect(normalizeSignatureDataUrl('abc123')).toBe('data:image/png;base64,abc123');
  });

  it('preserves existing data URL', () => {
    const url = 'data:image/png;base64,abc123';
    expect(normalizeSignatureDataUrl(url)).toBe(url);
  });
});

describe('estimateDataUrlBytes', () => {
  it('estimates base64 payload size', () => {
    const size = estimateDataUrlBytes('data:image/png;base64,AAAA');
    expect(size).toBeGreaterThan(0);
  });
});
