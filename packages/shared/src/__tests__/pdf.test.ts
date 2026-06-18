import { generateInspectionPdfHtml } from '../utils/pdf';

describe('generateInspectionPdfHtml', () => {
  it('generates HTML with inspection details', () => {
    const html = generateInspectionPdfHtml({
      driverName: 'John Driver',
      truckNumber: 'TRK-2041',
      trailerNumber: 'TRL-992',
      status: 'PASS',
      createdAt: '2024-01-15T10:00:00.000Z',
      sections: [
        {
          title: 'Engine Compartment',
          items: [{ name: 'Oil Level', status: 'pass' }],
        },
      ],
    });

    expect(html).toContain('John Driver');
    expect(html).toContain('TRK-2041');
    expect(html).toContain('Engine Compartment');
    expect(html).toContain('PASS');
  });
});
