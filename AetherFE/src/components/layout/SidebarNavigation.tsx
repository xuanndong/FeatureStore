import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Layers, RefreshCcw, Eye, Search, Database, Fingerprint,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

interface SidebarNavigationProps {
  isCollapsed: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Feature Groups', path: '/feature-groups', icon: Layers },
  { name: 'Entities', path: '/entities', icon: Fingerprint },
  { name: 'Data Sources', path: '/data-sources', icon: Database },
  { name: 'Materialization', path: '/materialization', icon: RefreshCcw },
  { name: 'Feature Views', path: '/feature-views', icon: Eye },
  { name: 'Online Explorer', path: '/online-explorer', icon: Search },
];

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ isCollapsed }) => {
  const location = useLocation();

  const navItems = useMemo(() => NAV_ITEMS, []);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        flex: 1,
        padding: '0 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        marginTop: '0.5rem',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);

        return (
          <NavLink
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              transition: 'background var(--transition)',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              textDecoration: 'none',
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} />
            {!isCollapsed && <span style={{ fontSize: '0.875rem' }}>{item.name}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
};
