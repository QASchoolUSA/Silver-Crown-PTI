import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Truck, ClipboardList, AlertTriangle, DollarSign, Route, Users } from 'lucide-react';
import {
  subscribeCompanyLoads,
  subscribeCompanyInspections,
  getCompanyDrivers,
  filterLoadsByPeriod,
  filterLoadsByDriver,
  computeLoadStats,
  getPeriodRange,
  formatCurrency,
  formatMilesTotal,
  getPickupLabel,
  getDropoffLabel,
  getDispatchSharePct,
  type Load,
  type AppUser,
  type PeriodPreset,
} from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import ActiveLoadsMap from '../components/ActiveLoadsMap';
import { statusLabel, statusPillClass } from '../components/LoadCard';

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'jan-jul-2026', label: 'Jan–Jul 2026' },
  { value: '2026-01', label: 'Jan 2026' },
  { value: '2026-02', label: 'Feb 2026' },
  { value: '2026-03', label: 'Mar 2026' },
  { value: '2026-04', label: 'Apr 2026' },
  { value: '2026-05', label: 'May 2026' },
  { value: '2026-06', label: 'Jun 2026' },
  { value: '2026-07', label: 'Jul 2026' },
];

export default function DashboardPage() {
  const { profile } = useAuth();
  const [allLoads, setAllLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [inspections, setInspections] = useState(0);
  const [defects, setDefects] = useState(0);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('jan-jul-2026');
  const [driverFilter, setDriverFilter] = useState<string>('all');

  useEffect(() => {
    if (!profile?.companyId) return;
    const unsubLoads = subscribeCompanyLoads(profile.companyId, setAllLoads);
    const unsubInspections = subscribeCompanyInspections(profile.companyId, (data) => {
      setInspections(data.length);
      setDefects(data.filter((i) => i.status === 'DEFECTS FOUND').length);
    });
    getCompanyDrivers(profile.companyId).then(setDrivers);
    return () => {
      unsubLoads();
      unsubInspections();
    };
  }, [profile?.companyId]);

  const activeLoads = useMemo(
    () => allLoads.filter((load) => load.status !== 'delivered'),
    [allLoads]
  );

  const period = useMemo(() => getPeriodRange(periodPreset), [periodPreset]);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.uid === driverFilter) ?? null,
    [drivers, driverFilter]
  );

  const periodLoads = useMemo(() => {
    const inPeriod = filterLoadsByPeriod(allLoads, period);
    return filterLoadsByDriver(inPeriod, driverFilter);
  }, [allLoads, period, driverFilter]);

  const fleetStats = useMemo(
    () => computeLoadStats(periodLoads, getDispatchSharePct(selectedDriver)),
    [periodLoads, selectedDriver]
  );

  const opsStats = [
    { label: 'Active Loads', value: activeLoads.length, icon: Truck, color: 'text-primary' },
    { label: 'Total Inspections', value: inspections, icon: ClipboardList, color: 'text-primary' },
    { label: 'Defects Found', value: defects, icon: AlertTriangle, color: 'text-error' },
  ];

  const payStats = [
    {
      label: 'Gross Pay',
      value: `$${formatCurrency(fleetStats.grossPay)}`,
      icon: DollarSign,
      color: 'text-primary',
    },
    {
      label: `Driver Pay (${fleetStats.dispatchSharePct}%)`,
      value: `$${formatCurrency(fleetStats.driverPay)}`,
      icon: Users,
      color: 'text-primary',
    },
    {
      label: 'Total Miles',
      value: formatMilesTotal(fleetStats.totalMiles),
      icon: Route,
      color: 'text-primary',
    },
    {
      label: 'Loads',
      value: fleetStats.loadCount,
      icon: Truck,
      color: 'text-primary',
    },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">DASHBOARD</h1>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Active Loads Map
          </h2>
          <Link to="/loads" className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">
            View all loads →
          </Link>
        </div>
        <ActiveLoadsMap loads={activeLoads} />
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Period
          </label>
          <select
            value={periodPreset}
            onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
            className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm min-w-[160px]"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Driver
          </label>
          <select
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="all">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.uid} value={driver.uid}>
                {driver.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">
          Fleet Activity — {period.label}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {payStats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface-container border border-outline-variant rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">
                  {label}
                </span>
                <Icon size={18} className={color} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden mb-10">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Loads in Period
          </h2>
          <Link to="/loads" className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">
            View all loads →
          </Link>
        </div>
        {periodLoads.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            No loads found for this period and driver filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-left">
                  <th className="p-4">Load</th>
                  <th className="p-4">Pickup</th>
                  <th className="p-4">Dropoff</th>
                  <th className="p-4">Miles</th>
                  <th className="p-4">Gross Pay</th>
                  <th className="p-4">Driver</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {periodLoads.map((load) => (
                  <tr key={load.id} className="border-b border-outline-variant/50 hover:bg-surface-container-high/40">
                    <td className="p-4">
                      <Link to={`/loads/${load.id}`} className="hover:text-primary">
                        <div className="font-semibold">{load.loadRef || load.id}</div>
                        {load.broker && (
                          <div className="text-on-surface-variant text-xs">{load.broker}</div>
                        )}
                      </Link>
                    </td>
                    <td className="p-4 max-w-[220px] truncate" title={getPickupLabel(load)}>
                      {getPickupLabel(load)}
                    </td>
                    <td className="p-4 max-w-[220px] truncate" title={getDropoffLabel(load)}>
                      {getDropoffLabel(load)}
                    </td>
                    <td className="p-4">{load.miles || '0'} mi</td>
                    <td className="p-4">${load.payout}</td>
                    <td className="p-4">{load.assignedDriverName || 'Unassigned'}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusPillClass(load.status)}`}
                      >
                        {statusLabel(load.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {opsStats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-surface-container border border-outline-variant rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">{label}</span>
              <Icon size={20} className={color} />
            </div>
            <p className={`text-4xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/loads/new"
          className="bg-primary/10 border border-primary rounded-lg p-6 hover:bg-primary/20 transition-colors"
        >
          <h3 className="font-bold text-primary mb-1">Create New Load</h3>
          <p className="text-on-surface-variant text-sm">Assign a load to a driver</p>
        </Link>
        <Link
          to="/invite-codes"
          className="bg-surface-container border border-outline-variant rounded-lg p-6 hover:border-primary transition-colors"
        >
          <h3 className="font-bold text-on-surface mb-1">Generate Invite Code</h3>
          <p className="text-on-surface-variant text-sm">Add new drivers or admins</p>
        </Link>
      </div>
    </div>
  );
}
