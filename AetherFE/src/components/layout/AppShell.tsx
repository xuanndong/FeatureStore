import React, { useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '@/hooks';
import { SidebarHeader } from '@/components/layout/SidebarHeader';
import { SidebarNavigation } from '@/components/layout/SidebarNavigation';
import { SidebarActions } from '@/components/layout/SidebarActions';
import { TopBar } from '@/components/layout/TopBar';

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  // Close mobile sidebar on route change
  const handleRouteChange = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(c => !c);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleRouteChange();
  }, [location.pathname, handleRouteChange]);

  const sidebarContent = (
    <>
      <SidebarHeader isCollapsed={isCollapsed} />
      <SidebarActions
        isCollapsed={isCollapsed}
        isDark={isDark}
        onToggleCollapsed={toggleCollapsed}
        onToggleTheme={toggleTheme}
      />
      <SidebarNavigation isCollapsed={isCollapsed} />
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop Sidebar */}
      <div
        className="hide-on-mobile"
        style={{
          width: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--transition)',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar-overlay${isMobileOpen ? ' open' : ''}`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
      />

      {/* Mobile Sidebar */}
      <div
        className={`mobile-sidebar${isMobileOpen ? ' open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {sidebarContent}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar onMobileMenuOpen={openMobileSidebar} />

        {/* Main scrollable content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
