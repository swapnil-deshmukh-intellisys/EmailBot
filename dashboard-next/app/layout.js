import './globals.css';
import './theme.css';
import './dashboard/reference-dashboard.css';
import './campaigns/reference-redesign.css';
import './client-data/reference-client-data.css';
import './dashboard/user/profile/profile-modern.css';
import { ThemeProvider } from '@/shared-components/layout-components/ThemeProvider';

const themeInitScript = `
  (function () {
    var allowedThemes = { light: true, dark: true, colorful: true };
    var aliases = { colour: 'colorful', aurora: 'colorful', 'aurora-colour': 'colorful' };
    function applyTheme(theme) {
      var normalizedTheme = aliases[theme] || theme;
      var safeTheme = allowedThemes[normalizedTheme] ? normalizedTheme : 'light';
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Inter:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

