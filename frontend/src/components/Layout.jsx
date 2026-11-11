import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, QrCode, Zap, LogOut } from 'lucide-react';
import styles from './Layout.module.css';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/generate', icon: QrCode, label: 'Create' },
];

export default function Layout({ onSignOut }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Zap size={18} className={styles.logoIcon} />
          <span>QR<strong>Track</strong></span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ''}`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {onSignOut && (
            <button className={styles.signOut} onClick={onSignOut} aria-label="Sign out">
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          )}
          <span className={styles.version}>v2.0.0</span>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
