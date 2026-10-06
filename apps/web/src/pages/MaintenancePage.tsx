import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Wrench } from 'lucide-react';
import {
  subscribeCompanyMaintenanceLogs,
  createMaintenanceLog,
  deleteMaintenanceLog,
  MAINTENANCE_CATEGORIES,
  type MaintenanceLog,
  type MaintenanceCategory,
  type MaintenanceUnitType,
} from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';

type UnitFilter = 'all' | MaintenanceUnitType;

function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString();
}

export default function MaintenancePage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MaintenanceCategory>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unitType, setUnitType] = useState<MaintenanceUnitType>('truck');
  const [unitNumber, setUnitNumber] = useState('');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<MaintenanceCategory>('oil');
  const [description, setDescription] = useState('');
  const [odometer, setOdometer] = useState('');
  const [shopName, setShopName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!profile?.companyId) return;
    return subscribeCompanyMaintenanceLogs(profile.companyId, setLogs);
  }, [profile?.companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesUnit = unitFilter === 'all' || log.unitType === unitFilter;
      const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
      const matchesSearch =
        !q ||
        log.unitNumber.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        (log.shopName?.toLowerCase().includes(q) ?? false) ||
        log.performedByName.toLowerCase().includes(q);
      return matchesUnit && matchesCategory && matchesSearch;
    });
  }, [logs, unitFilter, categoryFilter, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await createMaintenanceLog({
        companyId: profile.companyId,
        unitType,
        unitNumber: unitNumber.trim().toUpperCase(),
        serviceDate,
        category,
        description: description.trim(),
        odometerMiles: odometer ? Number(odometer) : null,
        shopName: shopName.trim() || null,
        cost: cost ? Number(cost) : null,
        performedByName: profile.displayName,
        createdByUid: profile.uid,
        notes: notes.trim() || null,
      });
      setShowForm(false);
      setUnitNumber('');
      setDescription('');
      setOdometer('');
      setShopName('');
      setCost('');
      setNotes('');
      setCategory('oil');
      setUnitType('truck');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service log.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(log: MaintenanceLog) {
    const canDelete = profile?.role === 'admin' || log.createdByUid === profile?.uid;
    if (!canDelete) return;
    if (!window.confirm(`Delete service record for ${log.unitType} ${log.unitNumber}?`)) return;
    try {
      await deleteMaintenanceLog(log.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider text-primary">
            MAINTENANCE LOG
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">
            Track what was serviced on each truck and trailer — oil, tires, brakes, shops, and cost.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm font-semibold"
        >
          <Plus size={16} />
          Log Service
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-surface-container border border-outline-variant rounded-lg p-6 mb-8 space-y-4"
        >
          <div className="flex items-center gap-2 text-on-surface font-semibold">
            <Wrench size={18} className="text-primary" />
            New service record
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Unit type</span>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as MaintenanceUnitType)}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
              >
                <option value="truck">Truck</option>
                <option value="trailer">Trailer</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Unit number</span>
              <input
                required
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5 uppercase"
                placeholder="104"
              />
            </label>
            <label className="text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Service date</span>
              <input
                required
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
              />
            </label>
            <label className="text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
              >
                {MAINTENANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'DOT' ? 'DOT' : c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">What was serviced</span>
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
                placeholder="Oil + filter, tire replacement, brake adjustment…"
              />
            </label>
            {unitType === 'truck' && (
              <label className="text-sm">
                <span className="text-on-surface-variant text-xs uppercase tracking-wider">Odometer (mi)</span>
                <input
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
                />
              </label>
            )}
            <label className="text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Shop / vendor</span>
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
              />
            </label>
            <label className="text-sm">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Cost</span>
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-on-surface-variant text-xs uppercase tracking-wider">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2.5"
              />
            </label>
          </div>
          {error && <p className="text-error text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save record'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-on-surface-variant border border-outline-variant"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unit, shop, or work…"
            className="bg-transparent text-on-surface flex-1 outline-none text-sm"
          />
        </div>
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value as UnitFilter)}
          className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm"
        >
          <option value="all">All units</option>
          <option value="truck">Trucks</option>
          <option value="trailer">Trailers</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | MaintenanceCategory)}
          className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm"
        >
          <option value="all">All categories</option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'DOT' ? 'DOT' : c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((log) => {
          const canDelete = profile?.role === 'admin' || log.createdByUid === profile?.uid;
          return (
            <div
              key={log.id}
              className="bg-surface-container border border-outline-variant rounded-lg p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-on-surface">
                    {log.unitType === 'truck' ? 'Truck' : 'Trailer'} {log.unitNumber}
                  </p>
                  <p className="text-on-surface-variant text-sm mt-1">{log.description}</p>
                  <p className="text-on-surface-variant text-xs mt-2">
                    {formatDate(log.serviceDate)}
                    {log.odometerMiles != null ? ` · ${log.odometerMiles.toLocaleString()} mi` : ''}
                    {log.shopName ? ` · ${log.shopName}` : ''}
                    {` · ${formatMoney(log.cost ?? undefined)}`}
                    {` · ${log.performedByName}`}
                  </p>
                  {log.notes ? (
                    <p className="text-on-surface-variant text-xs mt-2">{log.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-primary/15 text-primary">
                    {log.category}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(log)}
                      className="text-xs text-error font-semibold px-2 py-1 hover:bg-error-container/20 rounded"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-on-surface-variant py-12">
            No service logged yet. Log oil, tires, and shop work so the next driver knows what’s been done.
          </p>
        )}
      </div>
    </div>
  );
}
