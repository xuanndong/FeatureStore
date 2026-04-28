import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Edit2, Save, X, Clock, Database, Tag, Fingerprint, Layers } from 'lucide-react';
import { viewsApi } from '@/services/views';
import type { FeatureView, FeatureDiscovery } from '@/types';
import { useNotification } from '@/components/ui/Notification';

interface FeatureViewDetailData extends FeatureView {
  features: FeatureDiscovery[];
}

interface Props {
  viewId: string;
  onBack: () => void;
}

export const FeatureViewDetail: React.FC<Props> = ({ viewId, onBack }) => {
  const { showNotification } = useNotification();
  const [detail, setDetail] = useState<FeatureViewDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTtl, setEditTtl] = useState(3600);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const res = await viewsApi.getFeatureViewDetail(viewId);
      setDetail(res.data as unknown as FeatureViewDetailData);
      setEditName(res.data.name);
      setEditTtl(res.data.ttl_seconds);
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Không thể tải chi tiết Feature View');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [viewId, showNotification, onBack]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSave = async () => {
    if (!editName) return showNotification('error', 'Tên View không được để trống');
    try {
      setIsSaving(true);
      await viewsApi.updateFeatureView(viewId, {
        name: editName,
        ttl_seconds: editTtl
      });
      showNotification('success', 'Cập nhật Feature View thành công');
      setIsEditing(false);
      fetchDetail();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Cập nhật thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (detail) {
      setEditName(detail.name);
      setEditTtl(detail.ttl_seconds);
    }
  };

  if (loading || !detail) {
    return <div className="spinner" style={{ margin: '100px auto' }}></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button className="btn btn-ghost" onClick={onBack} style={{ padding: 0, gap: '6px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Chi tiết Feature View</h1>
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>ID: {detail.id.split('-')[0]}</span>
          </div>
        </div>

        {/* Edit / Save */}
        {!isEditing ? (
          <button className="btn btn-secondary" onClick={() => setIsEditing(true)} style={{ gap: '8px' }}>
            <Edit2 size={16} /> Chỉnh sửa
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-ghost" onClick={handleCancelEdit} disabled={isSaving}><X size={16} /> Hủy</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <div className="spinner spinner-sm"></div> : <><Save size={16} /> Lưu thay đổi</>}
            </button>
          </div>
        )}
      </div>

      {/* TMetadata Card */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', background: 'var(--bg-secondary)' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Tag size={14} /> TÊN VIEW
          </label>
          {isEditing ? (
            <input type="text" className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
          ) : (
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{detail.name}</div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Clock size={14} /> THỜI GIAN TỒN TẠI (TTL)
          </label>
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="number" className="form-input" value={editTtl} onChange={e => setEditTtl(Number(e.target.value))} style={{ width: '150px' }} />
              <span style={{ color: 'var(--text-secondary)' }}>giây</span>
            </div>
          ) : (
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{detail.ttl_seconds} giây</div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Fingerprint size={14} /> ENTITY (BẢNG XƯƠNG SỐNG)
          </label>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>
            {detail.features.length > 0 ? detail.features[0].entity_name : 'N/A'}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Đặc trưng cấu thành ({detail.features.length})</h3>
        </div>
        
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <tr>
              <th style={{ padding: '16px' }}>TÊN ĐẶC TRƯNG</th>
              <th style={{ padding: '16px' }}>KIỂU DỮ LIỆU</th>
              <th style={{ padding: '16px' }}>THUỘC NHÓM (FEATURE GROUP)</th>
            </tr>
          </thead>
          <tbody>
            {detail.features.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px', fontWeight: 500 }}>{f.name}</td>
                <td style={{ padding: '16px' }}>
                  <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>{f.data_type}</span>
                </td>
                <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <Database size={14} /> {f.group_name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
