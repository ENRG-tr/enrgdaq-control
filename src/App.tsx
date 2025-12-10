import { useEffect } from 'react';
import { useStore } from './store';
import './App.css';
import { Router, Route, Link, useRoute } from 'wouter';
import RunDashboard from './pages/RunDashboard';
import AdvancedControl from './pages/AdvancedControl';

const SidebarLink = ({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) => {
  const [isActive] = useRoute(href);
  return (
    <Link
      href={href}
      className={`nav-link d-flex align-items-center px-3 py-2 ${
        isActive ? 'active' : ''
      }`}
    >
      <i className={`fa-solid ${icon} me-3`}></i>
      {label}
    </Link>
  );
};
const App = () => {
  const { fetchClients, fetchRuns, pollClientStatus } = useStore();

  // Initial Data Load
  useEffect(() => {
    fetchClients();
    fetchRuns();

    const interval = setInterval(() => {
      fetchClients();
      pollClientStatus(); // Poll current client
      fetchRuns(); // Keep run list synced
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container-fluid vh-100 d-flex flex-column overflow-hidden p-0">
      <div className="row g-0 flex-grow-1 h-100">
        {/* Sidebar */}
        <div
          className="col-auto sidebar d-flex flex-column"
          style={{ width: '240px' }}
        >
          <div className="p-4 border-bottom border-secondary mb-3">
            <div className="fw-bold text-success fs-5">
              <i className="fa-solid fa-atom me-2"></i>ENRGDAQ
            </div>
            <small className="text-muted">ENRGDAQ Control</small>
          </div>

          <div className="nav flex-column px-2">
            <SidebarLink href="/" icon="fa-chart-line" label="Run Dashboard" />
            <SidebarLink
              href="/advanced"
              icon="fa-sliders"
              label="Advanced Control"
            />
          </div>

          <div className="mt-auto p-3 border-top border-secondary text-muted small">
            <div>
              <i className="fa-solid fa-server me-2"></i>CNC System v0.1
            </div>
            <div>
              <i className="fa-solid fa-database me-2"></i>PostgreSQL Linked
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col d-flex flex-column h-100 overflow-hidden bg-dark">
          <Router>
            <Route path="/">
              <RunDashboard />
            </Route>
            <Route path="/advanced">
              <AdvancedControl />
            </Route>
          </Router>
        </div>
      </div>
    </div>
  );
};

export default App;
