import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppearanceMode } from '@silver-crown/shared';

const STORAGE_KEY = 'silvercrown.theme';

type ResolvedScheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: AppearanceMode;
  resolved: ResolvedScheme;
  setMode: (mode: AppearanceMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): AppearanceMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'system' || raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return 'system';
}

function getSystemScheme(): ResolvedScheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveMode(mode: AppearanceMode): ResolvedScheme {
  return mode === 'system' ? getSystemScheme() : mode;
}

function applyDomTheme(resolved: ResolvedScheme) {
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>(() => readStoredMode());
  const [resolved, setResolved] = useState<ResolvedScheme>(() => resolveMode(readStoredMode()));

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    const r = resolveMode(next);
    setResolved(r);
    applyDomTheme(r);
  }, []);

  useEffect(() => {
    applyDomTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const r = getSystemScheme();
      setResolved(r);
      applyDomTheme(r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
