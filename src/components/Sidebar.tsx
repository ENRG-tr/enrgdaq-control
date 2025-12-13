'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

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
  const isActive = pathname === href;
  return (
    <Link
      href={isLocked ? '#' : href}
      className={`nav-link d-flex align-items-center px-3 py-2 d-flex gap-2 justify-content-between ${
        isActive ? 'active text-white bg-primary' : 'text-muted'
      }`}
      onClick={() => {
        if (isLocked) {
          toast.error(
            'You must have admin priviledges to access this section!'
          );
        }
      }}
    >
      <div className="d-flex align-items-center gap-2 w-100">
        <div style={{ width: '10%' }}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
        {label}
      </div>
      {isLocked && <i className="fa-solid fa-lock"></i>}
    </Link>
  );
};

export default function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <div
      className="col-auto sidebar d-flex flex-column border-end border-secondary bg-dark text-white"
      style={{ width: '240px', minHeight: '100vh' }}
    >
      <div className="p-4 border-bottom border-secondary mb-3">
        <div className="fw-bold text-success fs-5">
          <i className="fa-solid fa-atom me-2"></i>ENRGDAQ
        </div>
        <small className="text-muted">Control System</small>
      </div>

      <div className="nav flex-column px-2">
        <SidebarLink href="/" icon="fa-chart-line" label="Run Dashboard" />
        <SidebarLink href="/messages" icon="fa-envelope" label="Messages" />

        <div className="nav-item">
          <div className="nav-link d-flex align-items-center px-3 py-2">
            <div className="fw-bold text-muted">Advanced</div>
          </div>
        </div>
        <SidebarLink
          href="/advanced"
          icon="fa-sliders"
          label="Advanced Control"
          isLocked
        />
        <SidebarLink
          href="/templates"
          icon="fa-file-code"
          label="Templates"
          isLocked
        />
        <SidebarLink
          href="/run-types"
          icon="fa-tags"
          label="Run Types"
          isLocked
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
