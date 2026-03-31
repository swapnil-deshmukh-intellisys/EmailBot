import './globals.css';

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

export const metadata = {
  title: 'Email Automation Dashboard',
  description: 'Manage uploads, campaigns, templates, and sending status'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
