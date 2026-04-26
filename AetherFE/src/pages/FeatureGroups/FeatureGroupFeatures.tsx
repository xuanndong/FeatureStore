import React, { useEffect, useState } from 'react';
import { viewsApi } from '@/services/views';
import type { FeatureDiscovery } from '@/types';

interface FeatureGroupFeaturesProps {
  groupId: string;
}

export const FeatureGroupFeatures: React.FC<FeatureGroupFeaturesProps> = React.memo(({ groupId }) => {
  const [features, setFeatures] = useState<FeatureDiscovery[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const res = await viewsApi.listAvailableFeatures();
        if (isMounted) {
          // Filter out features that belong to this group
          const groupFeatures = res.data.filter(f => f.group_id === groupId);
          setFeatures(groupFeatures);
        }
      } catch (err) {
        console.error('Failed to load features for group', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFeatures();
    return () => { isMounted = false; };
  }, [groupId]);

  return (
    <div style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)', padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Features</h3>
        <span style={{ background: 'var(--surface)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
          {loading ? '...' : features.length}
        </span>
      </div>
      
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner spinner-sm" style={{ margin: '0 auto' }} /></div>
      ) : features.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Không có đặc trưng nào.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {features.map(f => (
            <div key={f.id} style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-primary)' }}>{f.name}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{f.data_type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

FeatureGroupFeatures.displayName = 'FeatureGroupFeatures';
