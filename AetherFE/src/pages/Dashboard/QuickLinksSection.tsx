import React from 'react';
import { QuickLinkCard, type QuickLinkItem } from '@/pages/Dashboard/QuickLinkCard';

interface QuickLinksGridProps {
  items: QuickLinkItem[];
  onNavigate: (path: string) => void;
}

export const QuickLinksSection: React.FC<QuickLinksGridProps> = ({ items, onNavigate }) => {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '3rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Truy cập nhanh
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Bắt đầu quy trình làm việc với các công cụ cốt lõi.
          </p>
        </div>
        <button className="btn btn-primary" style={{ background: '#818cf8', padding: '1rem' }}>
          Clusters Management
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(15rem, 100%), 1fr))',
          gap: '1.25rem',
        }}
      >
        {items.map((item) => (
          <QuickLinkCard
            key={item.title}
            title={item.title}
            desc={item.desc}
            icon={item.icon}
            path={item.path}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};
