import React from 'react';
import { Database, Table } from 'lucide-react';
import type { DatasetItem } from '@/types';

interface DatasetCardProps {
  item: DatasetItem;
  formatDate: (ts: number) => string;
  onClick: (id: string, type: string) => void;
}

export const DatasetCard: React.FC<DatasetCardProps> = ({ item, formatDate, onClick }) => {
  const isGroup = item.dataset_type === 'GROUP';

  return (
    <div 
      className="card" 
      style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px', background: '#fff' }}
      onClick={() => onClick(item.dataset_id, item.dataset_type)}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: isGroup ? 'var(--primary-light)' : '#f3e8ff', padding: '12px', borderRadius: '12px', color: isGroup ? 'var(--primary)' : '#9333ea' }}>
          {isGroup ? <Database size={24} /> : <Table size={24} />}
        </div>
        <div>
          <h3 style={{ fontWeight: 600, fontSize: '18px', marginBottom: '4px', color: 'var(--text-main)' }}>{item.name}</h3>
          <span style={{ fontSize: '12px', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            {item.dataset_type}
          </span>
        </div>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
        <span>Ngày tạo:</span>
        <span style={{ fontWeight: 500 }}>{formatDate(item.created_at)}</span>
      </div>
    </div>
  );
};
