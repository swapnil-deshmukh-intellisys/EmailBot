'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from './ThemeProvider';

function ThemeIcon({ theme }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" />
      </svg>
    );
  }

  if (theme === 'colorful') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18M3 12h18" />
        <circle cx="12" cy="12" r="7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
    </svg>
  );
}

function themeLabel(theme) {
  if (theme === 'colorful') return 'Colour';
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme, themes } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = () => {
    if (!buttonRef.current) {
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 10,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) {
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

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen]);

  const setActiveTheme = (nextTheme) => {
    setTheme(nextTheme);
    setMenuOpen(false);
  };

  const isDark = theme === 'dark';
  const isColorful = theme === 'colorful';
  const themeMenu = menuOpen && mounted && menuPosition ? createPortal(
    <div
      ref={popoverRef}
      className="theme-toggle-popover theme-toggle-popover-floating"
      role="menu"
      aria-label="Theme options"
      style={{ top: menuPosition.top, right: menuPosition.right }}
    >
      {themes.map((option) => (
        <button
          key={option}
          type="button"
          role="menuitemradio"
          aria-checked={theme === option}
          className={`theme-toggle-option ${theme === option ? 'active' : ''}`}
          onClick={() => setActiveTheme(option)}
        >
          <span className="theme-toggle-option-icon" aria-hidden="true"><ThemeIcon theme={option} /></span>
          <span className="theme-toggle-option-text">
            <span className="theme-toggle-option-title">
              {themeLabel(option)}
              {theme === option ? <span className="theme-toggle-current">Current</span> : null}
            </span>
            <span className="theme-toggle-option-copy">
              {option === 'light' ? 'Clean iOS light' : option === 'dark' ? 'Full dark comfort' : 'Premium colour'}
            </span>
          </span>
        </button>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div
      ref={menuRef}
      className={`theme-toggle-menu ${className} ${isDark ? 'is-dark' : isColorful ? 'is-colorful' : 'is-light'}`.trim()}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updateMenuPosition();
          setMenuOpen((open) => !open);
        }}
        className="theme-toggle-btn"
        aria-label={`Current theme: ${themeLabel(theme)}. Open theme menu`}
        title={`Current theme: ${themeLabel(theme)}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="theme-toggle-btn-icon" aria-hidden="true">
          <ThemeIcon theme={theme} />
        </span>
        <span className="theme-toggle-btn-label">{themeLabel(theme)}</span>
      </button>

      {themeMenu}
    </div>
  );
}
