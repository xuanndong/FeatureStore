import React, { useCallback } from 'react';
import { BookOpen, Menu } from 'lucide-react';
import Github from '@/components/icon/Github';

interface TopBarProps {
  onMobileMenuOpen: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMobileMenuOpen }) => {
  const handleGithubClick = useCallback(() => {
    window.open('https://github.com/xuanndong/FeatureStore.git', '_blank', 'noreferrer');
  }, []);

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        gap: '1rem',
        flexShrink: 0,
      }}
    >
      <button
        className="mobile-menu-btn"
        onClick={onMobileMenuOpen}
        aria-label="Open navigation menu"
      >
        <Menu size={22} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
        <button
          onClick={handleGithubClick}
          className="btn-ghost"
          style={{ padding: '0.5rem', borderRadius: '0.25rem', border: 'none' }}
          aria-label="View source on GitHub"
        >
          <Github size={20} />
        </button>
        <button className="btn btn-secondary">
          <BookOpen size={16} /> Docs
        </button>
      </div>
    </header>
  );
};
