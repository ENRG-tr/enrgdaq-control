'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { useStore } from '@/lib/store';

const SidebarLink = ({
  href,
  icon,
  label,
  isLocked,
}: {
  href: string;
  icon: string;
  label: string;
  isLocked?: boolean;
}) => {
  const pathname = usePathname();
  // Active if exact match or if it's a sub-route (but handle root '/' correctly)
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={isLocked ? '#' : href}
      className={`nav-link d-flex align-items-center justify-content-between px-3 py-2 mb-1 rounded-2 ${
        isActive ? 'active text-white bg-primary shadow-sm' : 'text-muted'
      }`}
      onClick={() => {
        if (isLocked) {
          toast.error('You must have admin privileges to access this section!');
        }
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <div className="sidebar-icon">
          <i className={`fa-solid ${icon}`}></i>
        </div>
        <span className="fw-medium">{label}</span>
      </div>
      {isLocked && <i className="fa-solid fa-lock text-secondary small"></i>}
    </Link>
  );
};

export default function Sidebar() {
  const { isAdmin, checkAuthStatus } = useStore();

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return (
    <div
      className="col-auto sidebar d-flex flex-column border-end border-secondary bg-dark text-white"
      style={{ width: '260px', minHeight: '100vh', transition: 'width 0.3s' }}
    >
      <div className="p-4 border-bottom border-secondary mb-3">
        <div className="fw-bold text-success fs-4 d-flex align-items-center mb-1">
          <i className="fa-solid fa-atom me-2"></i>
          <span>ENRGDAQ</span>
        </div>
        <div className="text-muted small letter-spacing-1">
          ENRGDAQ Control System
        </div>
      </div>

      <div className="nav flex-column px-3">
        <SidebarLink href="/" icon="fa-chart-line" label="Run Dashboard" />
        <SidebarLink href="/messages" icon="fa-envelope" label="Messages" />

        <div
          className="mt-4 mb-2 px-3 text-uppercase text-muted small fw-bold letter-spacing-2"
          style={{ fontSize: '0.75rem' }}
        >
          Advanced
        </div>

        <SidebarLink
          href="/advanced"
          icon="fa-sliders"
          label="Advanced Control"
          isLocked={!isAdmin}
        />
        <SidebarLink
          href="/templates"
          icon="fa-file-code"
          label="Templates"
          isLocked={!isAdmin}
        />
        <SidebarLink
          href="/run-types"
          icon="fa-tags"
          label="Run Types"
          isLocked={!isAdmin}
        />
        <SidebarLink
          href="/webhooks"
          icon="fa-satellite-dish"
          label="Webhooks"
          isLocked={!isAdmin}
        />
      </div>

      <div className="mt-auto p-3 border-top border-secondary text-muted small">
        <div>
          <i className="fa-solid fa-server me-2"></i>ENRGDAQ Control
        </div>
      </div>
    </div>
  );
}
