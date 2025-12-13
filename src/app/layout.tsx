import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import GlobalPoller from '@/components/GlobalPoller';
import { Toaster } from 'react-hot-toast';
import { checkAdminAccess } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ENRGDAQ Control',
  description: 'Control system for ENRGDAQ',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const isAdmin = checkAdminAccess(headersList);

  return (
    <html lang="en" data-bs-theme="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/glyphicons-halflings@1.9.1/css/glyphicons-halflings.min.css"
        />
      </head>
      <body className={`${inter.className} bg-dark text-light`}>
        <GlobalPoller />
        <Toaster position="top-right" />
        <div className="container-fluid vh-100 d-flex flex-column overflow-hidden p-0">
          <div className="row g-0 flex-grow-1 h-100">
            {/* Sidebar */}
            <Sidebar isAdmin={isAdmin} />

            {/* Main Content Area */}
            <div className="col d-flex flex-column h-100 overflow-hidden bg-dark">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
