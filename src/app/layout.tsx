import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import GlobalPoller from '@/components/GlobalPoller';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ENRGDAQ Control',
  description: 'Control system for ENRGDAQ data acquisition',
  keywords: ['DAQ', 'data acquisition', 'control system', 'ENRG'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-bs-theme="dark">
      <body className={`${inter.className} bg-dark text-light`}>
        <GlobalPoller />
        <Toaster position="top-right" />
        <div className="container-fluid vh-100 d-flex flex-column overflow-hidden p-0">
          <div className="row g-0 flex-grow-1 h-100">
            {/* Sidebar */}
            <Sidebar />

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
