export interface PTIStep {
  id: string;
  type: 'Truck' | 'Trailer';
  title: string;
  items: string[];
}

export const PTI_STEPS: PTIStep[] = [
  { id: 'engine', type: 'Truck', title: 'Engine Compartment', items: ['Oil Level', 'Coolant Level', 'Belts & Hoses'] },
  { id: 'cab', type: 'Truck', title: 'Cab/Start', items: ['Oil Pressure Gauge', 'Wipers', 'Horn', 'Mirrors'] },
  { id: 'lights', type: 'Truck', title: 'Lights/Reflectors', items: ['Headlights', 'Turn Signals', 'Reflectors'] },
  { id: 'brakes', type: 'Truck', title: 'Brakes', items: ['Air Leaks', 'Brake Shoes/Drums'] },
  { id: 'tires', type: 'Truck', title: 'Tires/Wheels', items: ['Tire Tread', 'Lug Nuts'] },
  { id: 'coupling', type: 'Trailer', title: 'Coupling System', items: ['Fifth Wheel', 'Kingpin'] },
  { id: 'air', type: 'Trailer', title: 'Air Lines', items: ['Glad Hands', 'Air Hoses'] },
  { id: 'gear', type: 'Trailer', title: 'Landing Gear', items: ['Crank Handle', 'Legs'] },
  { id: 'tires_trl', type: 'Trailer', title: 'Tires', items: ['Tire Tread', 'Lug Nuts'] },
  { id: 'lights_trl', type: 'Trailer', title: 'Tail/Brake Lights', items: ['Brake Lights', 'Turn Signals'] },
];

export type InspectionDataMap = Record<
  string,
  Record<string, { status: 'pass' | 'fail' | null; notes: string; photoUri?: string | null }>
>;

export function calculateInspectionStatus(data: InspectionDataMap): 'PASS' | 'DEFECTS FOUND' {
  for (const section of Object.values(data)) {
    for (const item of Object.values(section)) {
      if (item.status === 'fail') return 'DEFECTS FOUND';
    }
  }
  return 'PASS';
}

export function buildInspectionSections(data: InspectionDataMap) {
  return PTI_STEPS.map((step) => ({
    id: step.id,
    title: step.title,
    type: step.type,
    items: step.items.map((name) => {
      const itemData = data[step.id]?.[name] || { status: null, notes: '' };
      const item: { name: string; status: typeof itemData.status; notes?: string } = {
        name,
        status: itemData.status,
      };
      if (itemData.notes) {
        item.notes = itemData.notes;
      }
      return item;
    }),
  }));
}
