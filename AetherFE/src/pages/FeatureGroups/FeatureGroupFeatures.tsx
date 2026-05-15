import React from 'react';
import { Database } from 'lucide-react';
import type { FeatureInGroupRead } from '@/types';

interface FeatureGroupFeaturesProps {
  features: FeatureInGroupRead[];
}

export const FeatureGroupFeatures: React.FC<FeatureGroupFeaturesProps> = React.memo(({ features }) => {
  return (
    <div style={{ padding: '24px 20px', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* HEADER */}
      <div style={{ flexShrink: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} style={{ color: 'var(--text-secondary)' }} />
            Đặc trưng
          </h3>
          <span style={{
            background: 'rgba(2, 132, 199, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--primary)'
          }}>
            {features.length} đặc trưng
          </span>
        </div>
      </div>

      {/* DANH SÁCH FEATURES */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
        {features.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '40px', padding: '20px', background: 'var(--surface-hover)', borderRadius: '8px' }}>
            Chưa có dữ liệu đặc trưng.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {features.map(f => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'default',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, paddingRight: '12px' }}>
                  <div style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--primary)', opacity: 0.6, flexShrink: 0 }} />
                  <span style={{
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {f.name}
                  </span>
                </div>

                <span style={{
                  color: 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontFamily: '"Fira Code", monospace',
                  background: 'var(--bg)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  flexShrink: 0
                }}>
                  {f.data_type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

FeatureGroupFeatures.displayName = 'FeatureGroupFeatures';
