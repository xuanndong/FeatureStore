import React, { useState, useEffect } from 'react';
import { Search, Filter, Tag, Plus, Info, Database } from 'lucide-react';
import { viewsApi } from '@/services/views';
import type { FeatureDiscovery } from '@/types';
import { useNotification } from '@/components/ui/Notification';

export const FeatureViewsPage: React.FC = () => {
  const { showNotification } = useNotification();
  const [features, setFeatures] = useState<FeatureDiscovery[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // View Builder State
  const [viewName, setViewName] = useState('');
  const [ttl, setTtl] = useState(3600);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureDiscovery[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const res = await viewsApi.listAvailableFeatures(search || undefined);
        setFeatures(res.data);
      } catch (err: any) {
        showNotification('error', err.message || 'Lỗi tải danh sách features');
      } finally {
        setLoading(false);
      }
    };
    fetchFeatures();
  }, [search, showNotification]);

  const toggleFeature = (feature: FeatureDiscovery) => {
    if (selectedFeatures.find(f => f.id === feature.id)) {
      setSelectedFeatures(selectedFeatures.filter(f => f.id !== feature.id));
    } else {
      setSelectedFeatures([...selectedFeatures, feature]);
    }
  };

  const handleGenerate = async () => {
    if (!viewName) return showNotification('error', 'Vui lòng nhập tên View');
    if (selectedFeatures.length === 0) return showNotification('error', 'Vui lòng chọn ít nhất 1 đặc trưng');

    try {
      setIsGenerating(true);
      await viewsApi.createFeatureView({
        name: viewName,
        ttl_seconds: ttl,
        feature_ids: selectedFeatures.map(f => f.id)
      });
      showNotification('success', 'Tạo Feature View thành công!');
      setViewName('');
      setSelectedFeatures([]);
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Xây dựng Feature View</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tạo các view logic từ các nhóm đặc trưng vật lý để phục vụ cho các mô hình học máy.<br />Xác định thời gian tồn tại (TTL) và lựa chọn các đặc trưng cần thiết.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm đặc trưng hoặc nhóm..."
            className="form-input"
            style={{ paddingLeft: '36px' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary">
            <Filter size={16} /> Bộ lọc
          </button>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Hiển thị <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{features.length}</span> đặc trưng
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

        {/* Feature List Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {loading ? (
            <div className="spinner" style={{ margin: '40px auto', gridColumn: '1 / -1' }}></div>
          ) : features.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>Không tìm thấy đặc trưng nào</div>
          ) : (
            features.map(f => {
              const isSelected = !!selectedFeatures.find(sf => sf.id === f.id);
              return (
                <div
                  key={f.id}
                  className="card"
                  style={{
                    padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{f.name}</span>
                      <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>{f.data_type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <Database size={12} /> {f.group_name}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFeature(f)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      background: isSelected ? 'var(--primary-light)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-muted)'
                    }}
                  >
                    <Plus size={16} style={{ transform: isSelected ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* View Builder Panel */}
        <div className="card" style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <Tag size={18} color="var(--primary)" /> Cấu hình View
          </div>

          <div>
            <label className="form-label">Tên View</label>
            <input
              type="text" className="form-input" placeholder="vd: user_behavior_v1"
              value={viewName} onChange={e => setViewName(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>TTL (Giây)</label>
              <Info size={14} color="var(--text-muted)" />
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>⏱</div>
              <input
                type="number" className="form-input" style={{ paddingLeft: '32px' }}
                value={ttl} onChange={e => setTtl(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Đặc trưng đã chọn</label>
              <span className="badge" style={{ background: 'var(--surface)' }}>{selectedFeatures.length}</span>
            </div>

            {selectedFeatures.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Chưa có đặc trưng nào được chọn.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {selectedFeatures.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500 }}>{f.name}</span>
                    <button onClick={() => toggleFeature(f)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              onClick={handleGenerate}
              disabled={isGenerating || selectedFeatures.length === 0}
            >
              {isGenerating ? <div className="spinner spinner-sm"></div> : '⚡ Generate Feature View'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              View sẽ khả dụng ngay lập tức sau khi được tạo thành công.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
