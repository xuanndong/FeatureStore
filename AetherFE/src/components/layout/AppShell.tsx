import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Layers, RefreshCcw, Eye, Search,
  ChevronLeft, ChevronRight, Moon, Sun, BookOpen, Menu,
} from 'lucide-react';
import Github from '@/components/icon/Github';

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback(() => setIsCollapsed(c => !c), []);
  const openMobileSidebar = useCallback(() => setIsMobileOpen(true), []);
  const closeMobileSidebar = useCallback(() => setIsMobileOpen(false), []);


  const navItems = useMemo(() => [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Feature Groups', path: '/feature-groups', icon: Layers },
    { name: 'Materialization', path: '/materialization', icon: RefreshCcw },
    { name: 'Feature Views', path: '/feature-views', icon: Eye },
    { name: 'Online Explorer', path: '/online-explorer', icon: Search },
  ], []);


  const SidebarContent = (
    <>
      {/* Header */}
      <div style={{
        height: 'var(--topbar-height)',
        display: 'flex', alignItems: 'center',
        padding: isCollapsed ? '0 1.25rem' : '0 1.5rem',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border)',
        whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="src/assets/logo.svg"
              alt="Aether Logo"
              style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Aether Platform
            </span>
          </div>
        )}

        {isCollapsed && (
          <img
            src="src/assets/logo.svg"
            alt="Aether Logo"
            style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
          />
        )}
      </div>

      {/* Collapse toggle */}
      <div style={{
        display: 'flex',
        justifyContent: isCollapsed ? 'center' : 'flex-end',
        padding: '0.75rem 1rem',
      }}>
        <button
          onClick={toggleCollapsed}
          className="btn-ghost"
          style={{ padding: '0.25rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer', transition: 'transform var(--transition)', opacity: 0.8 }}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          flex: 1, padding: '0 0.75rem',
          display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem',
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
                display: 'flex', alignItems: 'center', gap: '0.75rem',
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

      {/* Bottom actions */}
      <div style={{
        padding: '1rem', borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.5rem 0.75rem', background: 'none', border: 'none',
            color: 'var(--text-primary)', cursor: 'pointer',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            fontWeight: 500, borderRadius: 'var(--radius-sm)',
          }}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div
        className="hide-on-mobile"
        style={{
          width: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          transition: 'width var(--transition)', zIndex: 10, flexShrink: 0,
        }}
      >
        {SidebarContent}
      </div>

      <div
        className={`sidebar-overlay${isMobileOpen ? ' open' : ''}`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />
      <div
        className={`mobile-sidebar${isMobileOpen ? ' open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {SidebarContent}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 'var(--topbar-height)',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem', gap: '1rem',
          flexShrink: 0,
        }}>
          <button
            className="mobile-menu-btn"
            onClick={openMobileSidebar}
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
            <a
              href="https://github.com/xuanndong/FeatureStore.git"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
              style={{ padding: '0.5rem', borderRadius: '0.25rem' }}
              aria-label="View source on GitHub"
            >
              <Github size={20} />
            </a>
            <button className="btn btn-secondary">
              <BookOpen size={16} /> Docs
            </button>
          </div>
        </header>

        {/* Main scrollable content */}
        <main style={{
          flex: 1, overflowY: 'auto',
          padding: '1.5rem', backgroundColor: 'var(--bg-secondary)',
        }}>
          <Outlet />
        </main>
      </div>

    </div>
  );
};
