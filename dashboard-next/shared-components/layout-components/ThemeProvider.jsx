'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_STORAGE_KEY = 'theme';
export const THEME_OPTIONS = ['light', 'dark', 'colorful'];

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  themes: THEME_OPTIONS,
});

export function normalizeTheme(theme) {
  if (theme === 'colour' || theme === 'aurora' || theme === 'aurora-colour') {
    return 'colorful';
  }
  return THEME_OPTIONS.includes(theme) ? theme : 'light';
}

export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') {
    return;
  }

  const safeTheme = normalizeTheme(theme);
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark', 'theme-colorful', 'dark');
  root.classList.add(`theme-${safeTheme}`);
  root.classList.toggle('dark', safeTheme === 'dark');
  root.setAttribute('data-theme', safeTheme);
  root.style.colorScheme = safeTheme === 'dark' ? 'dark' : 'light';

  if (document.body) {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-colorful', 'dark');
    document.body.classList.add(`theme-${safeTheme}`);
    document.body.classList.toggle('dark', safeTheme === 'dark');
  }
}

function getStoredTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  const setTheme = useCallback((nextTheme) => {
    const safeTheme = normalizeTheme(nextTheme);
    setThemeState(safeTheme);
    applyThemeToDocument(safeTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
      window.dispatchEvent(new CustomEvent('intellimailpilot:theme-change', { detail: { theme: safeTheme } }));
    } catch (error) {
      // Storage can be blocked in private contexts; the visible theme should still switch.
    }
  }, []);

  useEffect(() => {
    const initialTheme = getStoredTheme();
    setThemeState(initialTheme);
    applyThemeToDocument(initialTheme);

    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) {
        const nextTheme = normalizeTheme(event.newValue);
        setThemeState(nextTheme);
        applyThemeToDocument(nextTheme);
      }
    };

    const handleThemeChange = (event) => {
      const nextTheme = normalizeTheme(event.detail?.theme);
      setThemeState(nextTheme);
      applyThemeToDocument(nextTheme);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('intellimailpilot:theme-change', handleThemeChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('intellimailpilot:theme-change', handleThemeChange);
    };
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes: THEME_OPTIONS }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
