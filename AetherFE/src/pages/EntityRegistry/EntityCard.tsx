import React from 'react';
import { Fingerprint, Calendar, MoreVertical } from 'lucide-react';
import type { Entity } from '@/types';

interface EntityCardProps {
  item: Entity;
  formatDate: (ts: number) => string;
}

export const EntityCard: React.FC<EntityCardProps> = ({ item, formatDate }) => {
  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
      {/* Action Menu */}
      <button className="btn-ghost" style={{ position: 'absolute', top: '16px', right: '16px', padding: '4px' }}>
        <MoreVertical size={16} />
      </button>

      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ 
          background: 'var(--primary-light)', 
          color: 'var(--primary)', 
          padding: '10px', 
          borderRadius: '10px' 
        }}>
          <Fingerprint size={24} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={12} /> {formatDate(item.created_at)}
          </div>
        </div>
      </div>

      {/* Join Key Section */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.05em' }}>
          PRIMARY JOIN KEY
        </div>
        <code style={{ 
          display: 'block',
          background: 'var(--bg-secondary)', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '13px', 
          color: 'var(--primary)',
          fontWeight: 600,
          fontFamily: 'monospace'
        }}>
          {item.join_key}
        </code>
      </div>

      {/* Description */}
      <div style={{ flex: 1 }}>
        <p style={{ 
          fontSize: '13px', 
          color: 'var(--text-secondary)', 
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {item.description || 'Không có mô tả chi tiết cho thực thể này.'}
        </p>
      </div>
    </div>
  );
};
