import { useState } from 'react';
import { useNavigate } from 'react-router';
import { createLoad, getCompanyDrivers } from '@silver-crown/shared';
import type { EquipmentType, AppUser, LoadStop } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import LoadRouteMap from '../components/LoadRouteMap';
import StopAddressEditor from '../components/StopAddressEditor';
import {
  draftsToStops,
  initialStopDrafts,
  createStopDraftFromStop,
  type StopDraft,
} from '@silver-crown/shared';

const EQUIPMENT_TYPES: EquipmentType[] = ['Dry Van', 'Reefer', 'Flatbed'];

const PRESETS: {
  label: string;
  payout: string;
  miles: string;
  deadhead: string;
  type: EquipmentType;
  stops: LoadStop[];
}[] = [
  {
    label: 'Chicago → Dallas',
    payout: '2400',
    miles: '920',
    deadhead: '45',
    type: 'Dry Van',
    stops: [
      {
        type: 'pickup',
        address: '233 S Wacker Dr, Chicago, IL 60606, United States',
        coords: { latitude: 41.8789, longitude: -87.6359 },
        sequence: 0,
      },
      {
        type: 'dropoff',
        address: '1500 Marilla St, Dallas, TX 75201, United States',
        coords: { latitude: 32.7767, longitude: -96.797 },
        sequence: 0,
      },
    ],
  },
  {
    label: 'Atlanta → Miami',
    payout: '1850',
    miles: '660',
    deadhead: '12',
    type: 'Reefer',
    stops: [
      {
        type: 'pickup',
        address: '265 Peachtree Center Ave NE, Atlanta, GA 30303, United States',
        coords: { latitude: 33.759, longitude: -84.387 },
        sequence: 0,
      },
      {
        type: 'dropoff',
        address: '3500 Pan American Dr, Miami, FL 33133, United States',
        coords: { latitude: 25.728, longitude: -80.234 },
        sequence: 0,
      },
    ],
  },
];

export default function NewLoadPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [pickups, setPickups] = useState<StopDraft[]>(initialStopDrafts().pickups);
  const [dropoffs, setDropoffs] = useState<StopDraft[]>(initialStopDrafts().dropoffs);
  const [form, setForm] = useState({
    payout: '',
    miles: '',
    deadhead: '0',
    type: 'Dry Van' as EquipmentType,
    assignedDriverId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.companyId) getCompanyDrivers(profile.companyId).then(setDrivers);
  }, [profile?.companyId]);

  const previewStops = draftsToStops(pickups, dropoffs) ?? undefined;

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    const presetPickups = preset.stops.filter((s) => s.type === 'pickup');
    const presetDropoffs = preset.stops.filter((s) => s.type === 'dropoff');
    setPickups(presetPickups.map(createStopDraftFromStop));
    setDropoffs(presetDropoffs.map(createStopDraftFromStop));
    setForm({
      ...form,
      payout: preset.payout,
      miles: preset.miles,
      deadhead: preset.deadhead,
      type: preset.type,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;

    const stops = draftsToStops(pickups, dropoffs);
    if (!stops) {
      setError('Add at least one pickup and one drop-off, and select an address for each stop.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const driver = drivers.find((d) => d.uid === form.assignedDriverId);
      await createLoad({
        companyId: profile.companyId,
        stops,
        payout: form.payout,
        miles: form.miles,
        deadhead: form.deadhead,
        type: form.type,
        assignedDriverId: form.assignedDriverId || null,
        assignedDriverName: driver?.displayName,
      });
      navigate('/loads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">NEW LOAD</h1>

      <div className="flex gap-2 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="text-xs bg-surface-container-high border border-outline-variant rounded px-3 py-1 text-on-surface-variant hover:border-primary"
          >
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <StopAddressEditor
          pickups={pickups}
          dropoffs={dropoffs}
          onPickupsChange={setPickups}
          onDropoffsChange={setDropoffs}
        />

        {previewStops && previewStops.length >= 2 && (
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Route preview</p>
            <LoadRouteMap stops={previewStops} height="240px" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Payout ($)</label>
            <input
              type="text"
              value={form.payout}
              onChange={(e) => setForm({ ...form, payout: e.target.value })}
              className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Miles</label>
            <input
              type="text"
              value={form.miles}
              onChange={(e) => setForm({ ...form, miles: e.target.value })}
              className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Deadhead (mi)</label>
            <input
              type="text"
              value={form.deadhead}
              onChange={(e) => setForm({ ...form, deadhead: e.target.value })}
              className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Equipment Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as EquipmentType })}
            className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm"
          >
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Assign Driver</label>
          <select
            value={form.assignedDriverId}
            onChange={(e) => setForm({ ...form, assignedDriverId: e.target.value })}
            className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm"
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.uid} value={d.uid}>
                {d.displayName}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-on-primary font-bold px-6 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Creating...' : 'Create Load'}
        </button>
      </form>
    </div>
  );
}
