import { useEffect, useState } from 'react';
import { getCompanyUsers } from '@silver-crown/shared';
import type { AppUser } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';

export default function DriversPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;
    getCompanyUsers(profile.companyId).then(setUsers);
  }, [profile?.companyId]);

  const drivers = users.filter((u) => u.role === 'driver');
  const admins = users.filter((u) => u.role === 'admin');

  return (
    <div>
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">TEAM</h1>

      <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Drivers ({drivers.length})</h2>
      <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.uid} className="border-b border-outline-variant">
                <td className="p-4 font-semibold">{d.displayName}</td>
                <td className="p-4 text-on-surface-variant">{d.email}</td>
                <td className="p-4 text-on-surface-variant">{new Date(d.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <p className="text-center text-on-surface-variant py-8">No drivers yet. Generate an invite code to add drivers.</p>}
      </div>

      <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Admins ({admins.length})</h2>
      <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.uid} className="border-b border-outline-variant">
                <td className="p-4 font-semibold">{a.displayName}</td>
                <td className="p-4 text-on-surface-variant">{a.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
