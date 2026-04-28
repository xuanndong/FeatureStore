import React, { useState, useCallback } from 'react';
import { Search, Tag, Plus, Database, Fingerprint, ArrowLeft } from 'lucide-react';
import { viewsApi } from '@/services/views';
import type { FeatureDiscovery } from '@/types';
import { useNotification } from '@/components/ui/Notification';
import { useFeatureViewsFetch, useEntityFetch } from '@/hooks';
import { ErrorState } from '@/components/ui/ErrorState';
import { useDebounce } from '@/hooks/useDebounce';

interface Props {
  onBack: () => void;
}

export const FeatureViewBuilder: React.FC<Props> = ({ onBack }) => {
  const { showNotification } = useNotification();
  const handleError = useCallback((msg: string) => showNotification('error', msg), [showNotification]);

  const { data: entities } = useEntityFetch('', 1, handleError);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [searchFeature, setSearchFeature] = useState('');
  const debouncedSearchFeature = useDebounce(searchFeature, 500);
  
  const { features, loading, error, fetchFeatures } = useFeatureViewsFetch(debouncedSearchFeature, selectedEntityId, handleError);

  const [viewName, setViewName] = useState('');
  const [ttl, setTtl] = useState(3600);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureDiscovery[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEntityId(e.target.value);
    setSelectedFeatures([]);
  };

  const toggleFeature = useCallback((feature: FeatureDiscovery) => {
    setSelectedFeatures(prev => prev.find(f => f.id === feature.id) ? prev.filter(f => f.id !== feature.id) : [...prev, feature]);
  }, []);

  const handleGenerate = async () => {
    if (!selectedEntityId) return showNotification('error', 'Vui lòng chọn Entity trước');
    if (!viewName) return showNotification('error', 'Vui lòng nhập tên View');
    if (selectedFeatures.length === 0) return showNotification('error', 'Vui lòng chọn ít nhất 1 đặc trưng');

    try {
      setIsGenerating(true);
      await viewsApi.createFeatureView({
        name: viewName, ttl_seconds: ttl, entity_id: selectedEntityId, feature_ids: selectedFeatures.map(f => f.id)
      });
      showNotification('success', 'Tạo Feature View thành công!');
      onBack();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Lỗi tạo Feature View');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: 0, gap: '6px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Xây dựng Feature View</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tạo các view logic từ các nhóm đặc trưng vật lý.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}><Fingerprint size={16} /></div>
          <select className="form-select" style={{ paddingLeft: '36px', fontWeight: 600, border: '1px solid var(--primary)' }} value={selectedEntityId} onChange={handleEntityChange}>
            <option value="">-- Chọn Entity --</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.join_key})</option>)}
          </select>
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Tìm kiếm đặc trưng..." className="form-input" style={{ paddingLeft: '36px' }} value={searchFeature} onChange={e => setSearchFeature(e.target.value)} disabled={!selectedEntityId} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', alignContent: 'start' }}>
          {!selectedEntityId ? (
             <div className="empty-state" style={{ gridColumn: '1 / -1' }}>Chọn Entity để bắt đầu</div>
          ) : error ? (
            <div style={{ gridColumn: '1 / -1' }}><ErrorState message={error} onRetry={fetchFeatures} /></div>
          ) : loading ? (
            <div className="spinner" style={{ margin: '40px auto', gridColumn: '1 / -1' }}></div>
          ) : features.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>Không có dữ liệu</div>
          ) : (
            features.map(f => {
              const isSelected = !!selectedFeatures.find(sf => sf.id === f.id);
              return (
                <div key={f.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                   <div style={{ minWidth: 0, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Database size={12} style={{ flexShrink: 0 }}/> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.group_name}</span>
                      </div>
                    </div>
                    <button onClick={() => toggleFeature(f)} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, background: isSelected ? 'var(--primary-light)' : 'transparent', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <Plus size={16} style={{ transform: isSelected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                </div>
              );
            })
          )}
        </div>

        {/* Cart */}
        <div className="card" style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}><Tag size={18} color="var(--primary)" /> Cấu hình View</div>
            <div>
              <label className="form-label">Tên View</label>
              <input type="text" className="form-input" value={viewName} onChange={e => setViewName(e.target.value)} disabled={!selectedEntityId} />
            </div>
            <div>
              <label className="form-label">TTL (Giây)</label>
              <input type="number" className="form-input" value={ttl} onChange={e => setTtl(Number(e.target.value))} disabled={!selectedEntityId} />
            </div>
            <div>
              <label className="form-label">Đặc trưng đã chọn ({selectedFeatures.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {selectedFeatures.map(f => (
                   <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                     <span>{f.name}</span>
                     <button onClick={() => toggleFeature(f)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                   </div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating || selectedFeatures.length === 0 || !selectedEntityId}>
              {isGenerating ? <div className="spinner spinner-sm"></div> : '⚡ Generate View'}
            </button>
        </div>
      </div>
    </>
  );
};
