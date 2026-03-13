import './globals.css';

export const metadata = {
  title: 'Email Automation Dashboard',
  description: 'Manage uploads, campaigns, templates, and sending status'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
