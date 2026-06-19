import { calculateInspectionStatus, buildInspectionSections } from '../constants/ptiSteps';

describe('calculateInspectionStatus', () => {
  it('returns PASS when all items pass', () => {
    const data = {
      engine: {
        'Oil Level': { status: 'pass' as const, notes: '' },
        'Coolant Level': { status: 'pass' as const, notes: '' },
      },
    };
    expect(calculateInspectionStatus(data)).toBe('PASS');
  });

  it('returns DEFECTS FOUND when any item fails', () => {
    const data = {
      engine: {
        'Oil Level': { status: 'pass' as const, notes: '' },
        'Coolant Level': { status: 'fail' as const, notes: 'Low coolant' },
      },
    };
    expect(calculateInspectionStatus(data)).toBe('DEFECTS FOUND');
  });

  it('returns PASS when no items checked yet', () => {
    expect(calculateInspectionStatus({})).toBe('PASS');
  });
});

describe('buildInspectionSections', () => {
  it('builds sections from PTI steps and data', () => {
    const data = {
      engine: {
        'Oil Level': { status: 'pass' as const, notes: '' },
      },
    };
    const sections = buildInspectionSections(data);
    expect(sections.length).toBeGreaterThan(0);
    const engine = sections.find((s) => s.id === 'engine');
    expect(engine?.items.find((i) => i.name === 'Oil Level')?.status).toBe('pass');
    expect(engine?.items.find((i) => i.name === 'Coolant Level')?.notes).toBeUndefined();
  });

  it('omits notes field when empty so Firestore writes stay valid', () => {
    const sections = buildInspectionSections({
      engine: {
        'Oil Level': { status: 'pass', notes: '' },
      },
    });
    const item = sections.find((s) => s.id === 'engine')?.items.find((i) => i.name === 'Oil Level');
    expect(item).toBeDefined();
    expect('notes' in item!).toBe(false);
  });
});
