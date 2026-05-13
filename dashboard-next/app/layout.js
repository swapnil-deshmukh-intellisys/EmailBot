import './globals.css';
import { ThemeProvider } from '@/shared-components/layout-components/ThemeProvider';

const themeInitScript = `
  (function () {
    var allowedThemes = { light: true, dark: true, colorful: true };
    function applyTheme(theme) {
      var safeTheme = allowedThemes[theme] ? theme : 'light';
      var root = document.documentElement;
      root.classList.remove('theme-light', 'theme-dark', 'theme-colorful', 'dark');
      root.classList.add('theme-' + safeTheme);
      root.classList.toggle('dark', safeTheme === 'dark');
      root.setAttribute('data-theme', safeTheme);
      root.style.colorScheme = safeTheme === 'dark' ? 'dark' : 'light';
      if (document.body) {
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-colorful', 'dark');
        document.body.classList.add('theme-' + safeTheme);
        document.body.classList.toggle('dark', safeTheme === 'dark');
      }
      return safeTheme;
    }
    try {
      var saved = localStorage.getItem('theme');
      var theme = applyTheme(saved);
      document.addEventListener('DOMContentLoaded', function () { applyTheme(theme); });
      window.changeTheme = function (nextTheme) {
        var safeTheme = applyTheme(nextTheme);
        localStorage.setItem('theme', safeTheme);
        window.dispatchEvent(new CustomEvent('intellimailpilot:theme-change', { detail: { theme: safeTheme } }));
      };
    } catch (error) {
      applyTheme('light');
    }
  })();
`;

const chunkRecoveryScript = `
  (function () {
    var reloadKey = 'intellimailpilot:chunk-reload';
    function shouldReload(message) {
      return /ChunkLoadError|Loading chunk [\\w-]+ failed|_next\\/static\\/chunks/i.test(String(message || ''));
    }
    function reloadOnce() {
      try {
        var lastReloadAt = Number(sessionStorage.getItem(reloadKey) || 0);
        if (Date.now() - lastReloadAt < 30000) return;
        sessionStorage.setItem(reloadKey, String(Date.now()));
      } catch (error) {
        // If storage is unavailable, still recover the current session once.
      }
      window.location.reload();
    }
    window.addEventListener('error', function (event) {
      var target = event && event.target;
      var src = target && (target.src || target.href);
      if (src && String(src).indexOf('/_next/static/chunks/') !== -1) {
        reloadOnce();
        return;
      }
      if (shouldReload(event && (event.message || event.error && event.error.message))) {
        reloadOnce();
      }
    }, true);
    window.addEventListener('unhandledrejection', function (event) {
      var reason = event && event.reason;
      var message = reason && (reason.message || reason.toString && reason.toString());
      if (shouldReload(message)) reloadOnce();
    });
  })();
`;

export const metadata = {
  title: 'Email Automation Dashboard',
  description: 'Manage uploads, campaigns, templates, and sending status'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
