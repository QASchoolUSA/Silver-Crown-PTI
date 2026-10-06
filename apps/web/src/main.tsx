import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

// Avoid a flash of the wrong theme before React hydrates.
(() => {
  try {
    const stored = localStorage.getItem('silvercrown.theme');
    const mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const resolved =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : mode;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
