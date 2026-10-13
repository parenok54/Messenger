import './globals.css';
import { Toaster } from 'react-hot-toast';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Messenger',
  description: 'Fast, secure cross-platform messaging application',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Messenger',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#17212b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="select-none overscroll-none antialiased">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
