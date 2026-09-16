'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { useStore } from '@/lib/store';
import { API } from '@/lib/api-client';
import { NAVIGATION_ATTEMPT_EVENT } from '@/hooks/useNavigationGuard';

const SidebarLink = ({
  href,
  icon,
  label,
  isLocked,
  onNavigate,
}: {
  href: string;
  icon: string;
  label: string;
  isLocked?: boolean;
  onNavigate?: () => void;
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
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={isLocked || undefined}
      onClick={(event) => {
        if (isLocked) {
          event.preventDefault();
          toast.error('You must have admin privileges to access this section!');
          return;
        }

        const navigationEvent = new CustomEvent(NAVIGATION_ATTEMPT_EVENT, {
          detail: { href, handled: false },
        });
        window.dispatchEvent(navigationEvent);
        if (navigationEvent.detail.handled) {
          event.preventDefault();
          return;
        }

        onNavigate?.();
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <div className="sidebar-icon">
          <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
        </div>
        <span className="fw-medium">{label}</span>
      </div>
      {isLocked && (
        <i
          className="fa-solid fa-lock text-secondary small"
          aria-hidden="true"
        ></i>
      )}
    </Link>
  );
};

export default function Sidebar() {
  const { isAdmin, checkAuthStatus } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = useCallback(() => {
    if (isOpen) {
      menuButtonRef.current?.focus();
    }
    setIsOpen(false);
  }, [isOpen]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    API.getVersion()
      .then((v) => setCommitHash(v.commitHash))
      .catch(() => setCommitHash('unknown'));
  }, []);

  // Do not leave the main content inert if a phone is rotated to desktop width.
  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsOpen(false);
      }
    };

    desktopQuery.addEventListener('change', handleViewportChange);
    return () =>
      desktopQuery.removeEventListener('change', handleViewportChange);
  }, []);

  // Support the standard Escape gesture while the drawer is open.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    const mainContent = document.getElementById('main-content');
    document.body.classList.add('sidebar-menu-open');
    mainContent?.setAttribute('aria-hidden', 'true');
    mainContent?.setAttribute('inert', '');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('sidebar-menu-open');
      mainContent?.removeAttribute('aria-hidden');
      mainContent?.removeAttribute('inert');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeSidebar]);

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        className="sidebar-toggle btn btn-dark border-secondary rounded-circle shadow d-md-none"
        aria-controls="primary-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => (isOpen ? closeSidebar() : setIsOpen(true))}
      >
        <i
          className={`fa-solid ${isOpen ? 'fa-xmark' : 'fa-bars'}`}
          aria-hidden="true"
        ></i>
        <span className="visually-hidden">
          {isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        </span>
      </button>

      <button
        type="button"
        className={`sidebar-backdrop d-md-none ${isOpen ? 'is-visible' : ''}`}
        aria-label="Close navigation menu"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={closeSidebar}
      />

      <aside
        id="primary-navigation"
        className={`col-auto sidebar d-flex flex-column border-end border-secondary bg-dark text-white ${
          isOpen ? 'sidebar-open' : ''
        }`}
        style={{ width: '260px', minHeight: '100vh' }}
        aria-label="Primary navigation"
      >
        <div className="p-4 border-bottom border-secondary mb-3">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="min-width-0">
              <div className="fw-bold text-success fs-4 d-flex align-items-center mb-1">
                <i className="fa-solid fa-atom me-2" aria-hidden="true"></i>
                <span>ENRGDAQ</span>
              </div>
              <div className="text-muted small letter-spacing-1">
                ENRGDAQ Control System
              </div>
            </div>
            <button
              type="button"
              className="sidebar-close btn btn-sm btn-outline-secondary d-md-none flex-shrink-0"
              aria-label="Close navigation menu"
              onClick={closeSidebar}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <nav className="nav flex-column px-3" aria-label="Primary navigation links">
          <SidebarLink
            href="/"
            icon="fa-chart-line"
            label="Run Dashboard"
            onNavigate={closeSidebar}
          />
          <SidebarLink
            href="/messages"
            icon="fa-envelope"
            label="Messages"
            onNavigate={closeSidebar}
          />

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
            onNavigate={closeSidebar}
          />
          <SidebarLink
            href="/templates"
            icon="fa-file-code"
            label="Templates"
            isLocked={!isAdmin}
            onNavigate={closeSidebar}
          />
          <SidebarLink
            href="/run-types"
            icon="fa-tags"
            label="Run Types"
            isLocked={!isAdmin}
            onNavigate={closeSidebar}
          />
          <SidebarLink
            href="/webhooks"
            icon="fa-satellite-dish"
            label="Webhooks"
            isLocked={!isAdmin}
            onNavigate={closeSidebar}
          />
        </nav>

        <div className="mt-auto p-3 border-top border-secondary text-muted small">
          <div>
            <i className="fa-solid fa-server me-2" aria-hidden="true"></i>ENRGDAQ Control
          </div>
          {commitHash && (
            <div
              className="font-monospace text-muted opacity-75 mt-1"
              style={{ fontSize: '0.7rem', paddingLeft: '1.6rem' }}
              title={`Commit ${commitHash}`}
            >
              {commitHash}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
