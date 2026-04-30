import React, { useState, useCallback } from 'react';
import { Search, Tag, Plus, Database, Fingerprint, ArrowLeft, X } from 'lucide-react';
import { viewsApi } from '@/services/views';
import type { FeatureDiscovery } from '@/types';
import { useNotification } from '@/components/ui/Notification';
import { useFeatureViewsFetch, useEntityFetch } from '@/hooks';
import { ErrorState } from '@/components/ui/ErrorState';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/ui/Pagination';

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
  const [page, setPage] = useState(1);
  
  const { features, totalPages, loading, error, fetchFeatures } = useFeatureViewsFetch(debouncedSearchFeature, selectedEntityId, page, handleError);

  const [viewName, setViewName] = useState('');
  const [ttl, setTtl] = useState(3600);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureDiscovery[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEntityId(e.target.value);
    setSelectedFeatures([]);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchFeature(e.target.value);
    setPage(1);
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
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: 0, gap: '6px', color: 'var(--text-secondary)', marginBottom: '16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Xây dựng Feature View</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Ghép nối các đặc trưng từ nhiều nguồn khác nhau dựa trên Hợp đồng định danh.</p>
      </div>

      {/* Thanh công cụ tìm kiếm & Lọc Entity */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}>
            <Fingerprint size={16} />
          </div>
          <select 
            className="form-select" 
            style={{ paddingLeft: '36px', fontWeight: 600, border: '2px solid var(--primary)' }} 
            value={selectedEntityId} 
            onChange={handleEntityChange}
          >
            <option value="">-- Chọn Thực thể (Entity) --</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.join_key})</option>)}
          </select>
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder={selectedEntityId ? "Tìm kiếm đặc trưng..." : "Vui lòng chọn Thực thể trước..."} 
            className="form-input" 
            style={{ paddingLeft: '36px' }} 
            value={searchFeature} 
            onChange={handleSearchChange} 
            disabled={!selectedEntityId} 
          />
        </div>
      </div>

      {/* Main Grid: Danh sách Feature & Cart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start', marginTop: '8px' }}>
        
        {/* Cột trái: Danh sách Card Feature */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', alignContent: 'start' }}>
            {!selectedEntityId ? (
               <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', background: 'var(--surface-hover)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                 Vui lòng chọn một Thực thể (Entity) để xem các đặc trưng tương thích.
               </div>
            ) : error ? (
              <div style={{ gridColumn: '1 / -1' }}><ErrorState message={error} onRetry={fetchFeatures} /></div>
            ) : loading ? (
              <div className="spinner" style={{ margin: '40px auto', gridColumn: '1 / -1' }}></div>
            ) : features.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>Không tìm thấy đặc trưng nào.</div>
            ) : (
              features.map(f => {
              const isSelected = !!selectedFeatures.find(sf => sf.id === f.id);
              return (
                <div 
                  key={f.id} 
                  className="card" 
                  style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.1)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                   <div style={{ minWidth: 0, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.name}
                        </span>
                      </div>
                      
                      {/* BỔ SUNG HIỂN THỊ VERSION Ở ĐÂY */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Database size={13} style={{ flexShrink: 0, color: 'var(--primary)' }}/> 
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.group_name}
                        </span>
                        <span style={{ 
                          background: 'var(--surface-hover)', 
                          border: '1px solid var(--border)',
                          padding: '2px 6px', 
                          borderRadius: '12px', 
                          fontSize: '11px', 
                          fontWeight: 600,
                          color: 'var(--text-primary)' 
                        }}>
                          v{f.group_version}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => toggleFeature(f)} 
                      style={{ 
                        width: '32px', height: '32px', borderRadius: '50%', 
                        border: isSelected ? 'none' : '1px solid var(--border)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        cursor: 'pointer', flexShrink: 0, 
                        background: isSelected ? 'var(--primary)' : 'transparent', 
                        color: isSelected ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Plus size={16} style={{ transform: isSelected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                </div>
              );
            })
          )}
          </div>
          
          {features.length > 0 && totalPages > 1 && (
            <div style={{ marginTop: '24px' }}>
              <Pagination 
                currentPage={page} 
                totalPages={totalPages} 
                onPageChange={setPage} 
              />
            </div>
          )}
        </div>

        {/* Cột phải: Cart cấu hình View */}
        <div className="card" style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <Tag size={18} color="var(--primary)" /> Cấu hình Feature View
            </div>
            
            <div>
              <label className="form-label">Tên View <span style={{ color: 'red' }}>*</span></label>
              <input type="text" className="form-input" placeholder="Ví dụ: user_credit_scoring" value={viewName} onChange={e => setViewName(e.target.value)} disabled={!selectedEntityId} />
            </div>
            
            <div>
              <label className="form-label">Thời gian sống (TTL - Giây)</label>
              <input type="number" className="form-input" value={ttl} onChange={e => setTtl(Number(e.target.value))} disabled={!selectedEntityId} />
            </div>
            
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Đặc trưng đã chọn
                <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                  {selectedFeatures.length}
                </span>
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {selectedFeatures.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    Chưa có đặc trưng nào được chọn
                  </div>
                ) : (
                  selectedFeatures.map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <div style={{ minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.name}
                        </div>
                        {/* HIỂN THỊ CHI TIẾT GROUP & VERSION TRONG CART */}
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.group_name} <span style={{ color: 'var(--primary)', fontWeight: 600 }}>v{f.group_version}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleFeature(f)} 
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Xóa khỏi danh sách"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={handleGenerate} 
              disabled={isGenerating || selectedFeatures.length === 0 || !selectedEntityId || !viewName}
              style={{ width: '100%', padding: '12px', fontWeight: 600, marginTop: '8px' }}
            >
              {isGenerating ? <div className="spinner spinner-sm"></div> : '⚡ Generate View'}
            </button>
        </div>
      </div>
    </>
  );
};
