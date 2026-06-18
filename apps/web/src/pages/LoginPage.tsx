import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signIn } from '@silver-crown/shared';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-8">
      <div className="w-full max-w-md">
        <h1 className="font-[family-name:var(--font-bebas)] text-5xl text-primary text-center tracking-widest">SILVER CROWN</h1>
        <p className="text-on-surface-variant text-center text-sm uppercase tracking-wider mt-2 mb-10">Admin Dashboard</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
              placeholder="admin@silvercrown.com"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
              required
            />
          </div>
          {error && <p className="text-error text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg uppercase tracking-wider hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
