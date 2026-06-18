import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { generateInviteCode, getCompanyInviteCodes } from '@silver-crown/shared';
import type { InviteCode, UserRole } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';

export default function InviteCodesPage() {
  const { profile, user } = useAuth();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [role, setRole] = useState<UserRole>('driver');
  const [maxUses, setMaxUses] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadCodes = () => {
    if (profile?.companyId) getCompanyInviteCodes(profile.companyId).then(setCodes);
  };

  useEffect(() => { loadCodes(); }, [profile?.companyId]);

  const handleGenerate = async () => {
    if (!profile?.companyId || !user) return;
    setLoading(true);
    try {
      const result = await generateInviteCode(profile.companyId, role, user.uid, maxUses);
      setNewCode(result.code);
      loadCodes();
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">INVITE CODES</h1>

      <div className="bg-surface-container border border-outline-variant rounded-lg p-6 mb-8">
        <h2 className="font-bold mb-4">Generate New Code</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Max Uses</label>
            <input type="number" min={1} max={100} value={maxUses} onChange={(e) => setMaxUses(parseInt(e.target.value))} className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm" />
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading} className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg uppercase tracking-wider text-sm hover:opacity-90 disabled:opacity-60">
          {loading ? 'Generating...' : 'Generate Code'}
        </button>

        {newCode && (
          <div className="mt-4 flex items-center gap-3 bg-primary/10 border border-primary rounded-lg p-4">
            <span className="font-[family-name:var(--font-bebas)] text-3xl text-primary tracking-widest">{newCode}</span>
            <button onClick={() => copyCode(newCode)} className="text-primary hover:opacity-80">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
        )}
      </div>

      <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">Existing Codes</h2>
      <div className="space-y-2">
        {codes.map((code) => (
          <div key={code.id} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-lg p-4">
            <div>
              <span className="font-[family-name:var(--font-bebas)] text-xl text-primary tracking-widest">{code.code}</span>
              <p className="text-on-surface-variant text-xs mt-1">
                {code.role.toUpperCase()} • {code.usedCount}/{code.maxUses} uses • Expires {new Date(code.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <button onClick={() => copyCode(code.code)} className="text-on-surface-variant hover:text-primary">
              <Copy size={16} />
            </button>
          </div>
        ))}
        {codes.length === 0 && <p className="text-on-surface-variant text-center py-8">No invite codes yet.</p>}
      </div>
    </div>
  );
}
