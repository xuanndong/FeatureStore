import React from 'react';
import logo from '@/assets/logo.svg';

interface SidebarHeaderProps {
  isCollapsed: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ isCollapsed }) => {
  return (
    <div
      style={{
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        padding: isCollapsed ? '0 1.25rem' : '0 1.5rem',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {!isCollapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src={logo}
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
          src={logo}
          alt="Aether Logo"
          style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
        />
      )}
    </div>
  );
};
