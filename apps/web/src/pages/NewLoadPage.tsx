import { useState } from 'react';
import { useNavigate } from 'react-router';
import { createLoad, getCompanyDrivers } from '@silver-crown/shared';
import type { EquipmentType, AppUser } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const EQUIPMENT_TYPES: EquipmentType[] = ['Dry Van', 'Reefer', 'Flatbed'];

const PRESETS = [
  { origin: 'Chicago, IL', destination: 'Dallas, TX', payout: '2400', miles: '920', deadhead: '45', type: 'Dry Van' as EquipmentType, originCoords: { latitude: 41.8781, longitude: -87.6298 }, destCoords: { latitude: 32.7767, longitude: -96.7970 } },
  { origin: 'Atlanta, GA', destination: 'Miami, FL', payout: '1850', miles: '660', deadhead: '12', type: 'Reefer' as EquipmentType, originCoords: { latitude: 33.7490, longitude: -84.3880 }, destCoords: { latitude: 25.7617, longitude: -80.1918 } },
];

export default function NewLoadPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [form, setForm] = useState({
    origin: '', destination: '', payout: '', miles: '', deadhead: '0',
    type: 'Dry Van' as EquipmentType, assignedDriverId: '',
    originLat: '', originLng: '', destLat: '', destLng: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.companyId) getCompanyDrivers(profile.companyId).then(setDrivers);
  }, [profile?.companyId]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setForm({
      ...form,
      origin: preset.origin, destination: preset.destination,
      payout: preset.payout, miles: preset.miles, deadhead: preset.deadhead, type: preset.type,
      originLat: String(preset.originCoords.latitude), originLng: String(preset.originCoords.longitude),
      destLat: String(preset.destCoords.latitude), destLng: String(preset.destCoords.longitude),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;
    setLoading(true);
    setError('');
    try {
      const driver = drivers.find((d) => d.uid === form.assignedDriverId);
      await createLoad({
        companyId: profile.companyId,
        origin: form.origin,
        destination: form.destination,
        payout: form.payout,
        miles: form.miles,
        deadhead: form.deadhead,
        type: form.type,
        assignedDriverId: form.assignedDriverId || null,
        assignedDriverName: driver?.displayName,
        originCoords: { latitude: parseFloat(form.originLat), longitude: parseFloat(form.originLng) },
        destCoords: { latitude: parseFloat(form.destLat), longitude: parseFloat(form.destLng) },
      });
      navigate('/loads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create load');
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div>
      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
        required={['origin', 'destination', 'payout', 'miles'].includes(key)}
      />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">NEW LOAD</h1>

      <div className="flex gap-2 mb-6">
        {PRESETS.map((p) => (
          <button key={p.origin} type="button" onClick={() => applyPreset(p)} className="text-xs bg-surface-container-high border border-outline-variant rounded px-3 py-1 text-on-surface-variant hover:border-primary">
            {p.origin.split(',')[0]} → {p.destination.split(',')[0]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field('Origin', 'origin')}
          {field('Destination', 'destination')}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {field('Payout ($)', 'payout')}
          {field('Miles', 'miles')}
          {field('Deadhead (mi)', 'deadhead')}
        </div>
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Equipment Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as EquipmentType })} className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
            {EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('Origin Lat', 'originLat')}
          {field('Origin Lng', 'originLng')}
          {field('Dest Lat', 'destLat')}
          {field('Dest Lng', 'destLng')}
        </div>
        <div>
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Assign Driver</label>
          <select value={form.assignedDriverId} onChange={(e) => setForm({ ...form, assignedDriverId: e.target.value })} className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
            <option value="">Unassigned</option>
            {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.displayName}</option>)}
          </select>
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="bg-primary text-on-primary font-bold px-6 py-3 rounded-lg uppercase tracking-wider hover:opacity-90 disabled:opacity-60">
          {loading ? 'Creating...' : 'Create Load'}
        </button>
      </form>
    </div>
  );
}
