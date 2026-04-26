import React from 'react';
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react';

interface SidebarActionsProps {
  isCollapsed: boolean;
  isDark: boolean;
  onToggleCollapsed: () => void;
  onToggleTheme: () => void;
}

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  isCollapsed,
  isDark,
  onToggleCollapsed,
  onToggleTheme,
}) => {
  return (
    <>
      {/* Collapse toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: isCollapsed ? 'center' : 'flex-end',
          padding: '0.75rem 1rem',
        }}
      >
        <button
          onClick={onToggleCollapsed}
          className="btn-ghost"
          style={{
            padding: '0.25rem',
            borderRadius: '0.25rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'transform var(--transition)',
            opacity: 0.8,
          }}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Bottom actions */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <button
          onClick={onToggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
          }}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </div>
    </>
  );
};
