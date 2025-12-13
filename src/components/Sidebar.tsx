'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SidebarLink = ({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) => {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`nav-link d-flex align-items-center px-3 py-2 ${
        isActive ? 'active text-white bg-primary' : 'text-muted'
      }`}
    >
      <i className={`fa-solid ${icon} me-3`}></i>
      {label}
    </Link>
  );
};

export default function Sidebar() {
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
        />
        <SidebarLink href="/templates" icon="fa-file-code" label="Templates" />
        <SidebarLink href="/run-types" icon="fa-tags" label="Run Types" />
      </div>

      <div className="mt-auto p-3 border-top border-secondary text-muted small">
        <div>
          <i className="fa-solid fa-server me-2"></i>ENRGDAQ Control
        </div>
      </div>
    </div>
  );
}
