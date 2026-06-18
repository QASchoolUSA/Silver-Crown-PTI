import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Mail, Calendar, Truck } from 'lucide-react';
import { getUserProfile, updateDriverEquipment, EQUIPMENT_TYPES } from '@silver-crown/shared';
import type { AppUser, EquipmentType } from '@silver-crown/shared';

function formatEquipment(types?: EquipmentType[]) {
  if (!types?.length) return 'None assigned';
  return types.join(', ');
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [driver, setDriver] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getUserProfile(id)
      .then(setDriver)
      .finally(() => setLoading(false));
  }, [id]);

  const toggleEquipment = async (type: EquipmentType) => {
    if (!driver || driver.role !== 'driver') return;
    const current = driver.equipmentTypes ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];

    setSaving(true);
    try {
      await updateDriverEquipment(driver.uid, next);
      setDriver({ ...driver, equipmentTypes: next });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!driver || driver.role !== 'driver') {
    return (
      <div>
        <Link
          to="/drivers"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm mb-6"
        >
          <ArrowLeft size={16} /> Back to Team
        </Link>
        <p className="text-on-surface-variant">Driver not found.</p>
      </div>
    );
  }

  const selected = driver.equipmentTypes ?? [];

  return (
    <div className="max-w-2xl">
      <Link
        to="/drivers"
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Team
      </Link>

      <div className="flex items-start gap-5 mb-8">
        <div className="w-20 h-20 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0">
          <span className="font-[family-name:var(--font-bebas)] text-3xl text-primary">
            {driver.displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider uppercase">
            {driver.displayName}
          </h1>
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-primary/20 text-primary">
            Driver
          </span>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-lg p-5 mb-6 space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <Mail size={16} className="text-on-surface-variant shrink-0" />
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Email</p>
            <p className="font-semibold">{driver.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-on-surface-variant shrink-0" />
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Joined</p>
            <p className="font-semibold">{new Date(driver.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Truck size={16} className="text-on-surface-variant shrink-0" />
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Current Equipment</p>
            <p className="font-semibold">{formatEquipment(selected)}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-lg p-5">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
          Authorized Equipment
        </h2>
        <p className="text-on-surface-variant text-sm mb-4">
          Select the equipment types this driver is qualified to operate.
        </p>

        <div className="flex flex-wrap gap-3">
          {EQUIPMENT_TYPES.map((type) => {
            const isSelected = selected.includes(type);
            return (
              <button
                key={type}
                type="button"
                disabled={saving}
                onClick={() => toggleEquipment(type)}
                className={`px-5 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                  isSelected
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>

        {selected.length === 0 && (
          <p className="text-on-surface-variant text-xs mt-4">
            No equipment assigned yet. Tap a type above to authorize this driver.
          </p>
        )}
      </div>
    </div>
  );
}
