'use client';

import { useEffect, useRef, useState } from 'react';

const THEMES = ['light', 'dark', 'colorful'];

function getPreferredTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const savedTheme = window.localStorage.getItem('theme');
  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'colorful') {
    return savedTheme;
  }

  return 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const setActiveTheme = (nextTheme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem('theme', nextTheme);
    setMenuOpen(false);
  };

  const isDark = theme === 'dark';
  const isColorful = theme === 'colorful';

  return (
    <div
      ref={menuRef}
      className={`theme-toggle-menu ${className} ${isDark ? 'is-dark' : isColorful ? 'is-colorful' : 'is-light'}`.trim()}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="theme-toggle-btn"
        aria-label={`Current theme: ${theme}. Open theme menu`}
        title={`Current theme: ${theme}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="theme-toggle-btn-icon" aria-hidden="true">
          {isDark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.5v2.2M12 19.3v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
            </svg>
          ) : isColorful ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v18M3 12h18" />
              <circle cx="12" cy="12" r="7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" />
            </svg>
          )}
        </span>
        <span className="theme-toggle-btn-label">{theme}</span>
      </button>

      {menuOpen ? (
        <div className="theme-toggle-popover" role="menu" aria-label="Theme options">
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option}
              className={`theme-toggle-option ${theme === option ? 'active' : ''}`}
              onClick={() => setActiveTheme(option)}
            >
              <span className="theme-toggle-option-title">{option}</span>
              <span className="theme-toggle-option-copy">
                {option === 'light' ? 'Clean default' : option === 'dark' ? 'Low-glare comfort' : 'Branded accent'}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
