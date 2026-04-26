import React from 'react';

export interface QuickLinkItem {
  title: string;
  desc: string;
  icon: React.ElementType;
  path: string;
}

export interface QuickLinkCardProps {
  title: string;
  desc: string;
  icon: React.ElementType;
  path: string;
  onNavigate: (path: string) => void;
}

export const QuickLinkCard = React.memo<QuickLinkCardProps>(
  ({ title, desc, icon: Icon, path, onNavigate }) => (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--surface)',
        borderColor: 'transparent',
        padding: '1.5rem',
      }}
    >
      <div style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
        <Icon size={24} />
      </div>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {title}
      </h3>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          lineHeight: 1.5,
          flex: 1,
          marginBottom: '1.5rem',
        }}
      >
        {desc}
      </p>
      <button
        className="btn-text-link"
        onClick={() => onNavigate(path)}
        >
          Bắt đầu ngay <span>→</span>
      </button>
    </div>
  )
);
QuickLinkCard.displayName = 'QuickLinkCard';
