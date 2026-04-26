import React from 'react';
import { Database, Activity, ExternalLink } from 'lucide-react';
import { TypeBadge } from '@/components/ui/StatusBadge';
import type { DataSource } from '@/types';

interface DataSourceCardProps {
  item: DataSource;
  timeAgo: string;
}

export const DataSourceCard: React.FC<DataSourceCardProps> = ({ item, timeAgo }) => {
  const isBatch = item.source_type === 'BATCH';

  return (
    <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
      {/* Card Header */}
      <div style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div
          style={{
            background: isBatch ? '#ede9fe' : '#d1fae5',
            color: isBatch ? '#5b21b6' : '#065f46',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isBatch ? <Database size={20} /> : <Activity size={20} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.name}
            </h3>
            <TypeBadge
              label={item.source_type}
              variant={isBatch ? 'batch' : 'stream'}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Provider • {item.source_format}
          </div>
        </div>
      </div>

      {/* Location URI */}
      <div style={{ padding: '0 20px 20px' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '4px',
            letterSpacing: '0.05em',
          }}
        >
          LOCATION URI
        </div>
        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            wordBreak: 'break-all',
          }}
        >
          {item.location_uri}
          <ExternalLink
            size={14}
            style={{
              flexShrink: 0,
              marginLeft: '8px',
              cursor: 'pointer',
              opacity: 0.5,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomLeftRadius: 'var(--radius-md)',
          borderBottomRightRadius: 'var(--radius-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span
            className={`status-dot ${
              item.connection_status ? 'connected' : 'disconnected'
            }`}
          ></span>
          {item.connection_status ? 'Đã kết nối' : 'Mất kết nối'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Cập nhật: {timeAgo}
        </div>
      </div>
    </div>
  );
};
