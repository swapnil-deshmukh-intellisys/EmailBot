import './globals.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const themeInitScript = `
  (function () {
    try {
      var saved = localStorage.getItem('theme');
      var theme = saved === 'light' || saved === 'dark' || saved === 'colorful'
        ? saved
        : 'light';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-theme', theme);
      window.changeTheme = function (nextTheme) {
        var safeTheme = nextTheme === 'dark' || nextTheme === 'colorful' ? nextTheme : 'light';
        document.documentElement.classList.toggle('dark', safeTheme === 'dark');
        document.documentElement.setAttribute('data-theme', safeTheme);
        localStorage.setItem('theme', safeTheme);
      };
    } catch (error) {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
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
        {children}
      </body>
    </html>
  );
}
