import type { AppearanceMode } from '@silver-crown/shared';
import { useTheme } from '../context/ThemeContext';

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match device setting' },
  { value: 'light', label: 'Light', hint: 'Daylight surfaces' },
  { value: 'dark', label: 'Dark', hint: 'Low-glare night UI' },
];

export default function SettingsPage() {
  const { mode, setMode } = useTheme();

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl text-primary tracking-widest mb-2">
        SETTINGS
      </h1>
      <p className="text-on-surface-variant text-sm mb-8">
        App preferences for this browser. More options can be added here later.
      </p>

      <section className="bg-surface-container border border-outline-variant rounded-lg p-6 mb-6">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
          Appearance
        </h2>
        <p className="text-on-surface-variant text-sm mb-4">
          Choose how Silver Crown looks on this device.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Appearance">
          {APPEARANCE_OPTIONS.map((opt) => {
            const selected = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(opt.value)}
                className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                  selected
                    ? 'border-primary bg-primary/15 text-on-surface'
                    : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/50 hover:text-on-surface'
                }`}
              >
                <span className="block text-sm font-semibold text-on-surface">{opt.label}</span>
                <span className="block text-xs mt-1">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-surface-container border border-outline-variant rounded-lg p-6 mb-6">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
          Preferences
        </h2>
        <p className="text-on-surface-variant text-sm">
          Units, default truck numbers, and map preferences will live here.
        </p>
      </section>

      <section className="bg-surface-container border border-outline-variant rounded-lg p-6">
        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">
          About
        </h2>
        <p className="text-on-surface text-sm font-semibold">Silver Crown PTI</p>
        <p className="text-on-surface-variant text-xs mt-1">Admin Dashboard · v1.0.0</p>
      </section>
    </div>
  );
}
