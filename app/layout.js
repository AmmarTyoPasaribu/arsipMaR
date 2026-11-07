import { Rubik } from 'next/font/google';
import './globals.css';

const rubik = Rubik({ subsets: ['latin'], variable: '--font-rubik', display: 'swap' });

export const metadata = {
  title: 'ArsipMaR — Personal Archive',
  description: 'Personal archive for chat and email management',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1b1418' },
    { media: '(prefers-color-scheme: light)', color: '#ffe1ee' },
  ],
};

// Light is the default; apply a saved dark choice before first paint so it doesn't flash
const themeScript = `try{if(localStorage.getItem('arsipmar-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={rubik.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
