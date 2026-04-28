import React from 'react';
import { Database, Table, CalendarDays, ArrowRight, Activity, Tag } from 'lucide-react';
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
      style={{ 
        cursor: 'pointer', 
        transition: 'all 0.25s ease', 
        border: '1px solid var(--border-color)', 
        borderRadius: '16px', 
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={() => onClick(item.dataset_id, item.dataset_type)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
        e.currentTarget.style.borderColor = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
    >
      <div style={{ padding: '24px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ 
            background: isGroup ? 'var(--bg-secondary)' : '#f3e8ff', 
            padding: '14px', 
            borderRadius: '14px', 
            color: isGroup ? 'var(--primary)' : '#9333ea' 
          }}>
            {isGroup ? <Database size={24} /> : <Table size={24} />}
          </div>
          <span style={{ 
            fontSize: '11px', 
            background: isGroup ? 'var(--bg-secondary)' : '#f3e8ff', 
            padding: '6px 12px', 
            borderRadius: '20px', 
            fontWeight: 600, 
            color: isGroup ? 'var(--primary)' : '#9333ea',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            <Tag size={12} />
            {item.dataset_type === 'GROUP' ? 'Feature Group' : 'Feature View'}
          </span>
        </div>
        
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '20px', marginBottom: '8px', color: 'var(--text-main)', lineHeight: 1.3 }}>
            {item.name}
          </h3>
        </div>
      </div>

      <div style={{ padding: '16px 24px', background: '#fafafa', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          <CalendarDays size={14} />
          <span>{formatDate(item.created_at)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>
          <Activity size={14} /> Workspace <ArrowRight size={16} />
        </div>
      </div>
    </div>
  );
};
