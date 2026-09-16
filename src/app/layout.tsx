import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import GlobalPoller from '@/components/GlobalPoller';
import { Toaster } from 'react-hot-toast';



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
      <body className="bg-dark text-light">
        <GlobalPoller />
        <Toaster position="top-right" />
        <div className="container-fluid app-shell vh-100 d-flex flex-column overflow-hidden p-0">
          <div className="row app-layout g-0 flex-grow-1 h-100">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main
              id="main-content"
              className="col app-main d-flex flex-column h-100 overflow-hidden bg-dark"
            >
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
