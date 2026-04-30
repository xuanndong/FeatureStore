import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Edit2, Save, X, Clock, Database, Tag, Fingerprint, Activity, Calendar, GitCommit, AlertTriangle, Trash2 } from 'lucide-react';
import { viewsApi } from '@/services/views';
import type { FeatureView, FeatureDiscovery, MaterializationJob } from '@/types';
import { useNotification } from '@/components/ui/Notification';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';

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

  const [jobs, setJobs] = useState<MaterializationJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchJobs = useCallback(async () => {
    try {
      setLoadingJobs(true);
      const res = await viewsApi.listMaterializationJobs(viewId, undefined, jobsPage, 5);
      setJobs(res.data.items);
      setJobsTotalPages(res.data.pagination.total_pages);
    } catch (err: any) {
      showNotification('error', 'Lỗi cập nhật danh sách Materialization Jobs');
    } finally {
      setLoadingJobs(false);
    }
  }, [viewId, jobsPage, showNotification]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    let ws: WebSocket;
    try {
      const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace('http', 'ws') + '/views/ws/materialization';
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'MATERIALIZATION_JOB_UPDATE') {
          const payload = data.data;
          if (payload.feature_view_id === viewId) {
             setJobs(prevJobs => prevJobs.map(j => {
                if (j.id === payload.id) {
                    return { ...j, status: payload.status, updated_at: payload.updated_at, message: payload.message };
                }
                return j;
             }));
          }
        }
      };
    } catch (error) {
      console.error('WS Error:', error);
    }
    
    return () => {
      if (ws) ws.close();
    };
  }, [viewId]);

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

  const executeDelete = async () => {
    try {
      setIsDeleting(true);
      await viewsApi.deleteFeatureView(viewId);
      showNotification('success', 'Đã xóa Feature View');
      setShowDeleteConfirm(false);
      onBack();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Xóa thất bại');
      setIsDeleting(false);
    }
  };

  if (loading || !detail) {
    return <div className="spinner" style={{ margin: '100px auto' }}></div>;
  }

  return (
    <>
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        height: '100%', 
        minHeight: 0,
        background: 'var(--bg)',
        overflow: 'hidden'
      }}>
        
        <div style={{ 
          flex: '0 0 320px', 
          height: '100%', 
          borderRight: '1px solid var(--border)',
          overflowY: 'auto', 
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px'
        }}>
          <div style={{ flexShrink: 0, paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} style={{ color: 'var(--text-secondary)' }} />
                Feature View
              </h3>
              <span style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: 'var(--primary)' }}>
                {detail.features.length} đặc trưng
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {detail.features.map((f, idx) => (
              <div key={`${f.id}-${idx}`} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' }}>
                    {f.name}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: '"Fira Code", monospace', background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                    {f.data_type}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '8px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                    <Database size={12} />
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.group_name}>
                      {f.group_name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '11px', fontWeight: 600, background: 'rgba(99, 102, 241, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    <GitCommit size={10} /> v{f.group_version || '1'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ 
          flex: 1, 
          padding: '32px', 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          overflowY: 'auto',
          gap: '24px'
        }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            <div>
              <button className="btn btn-ghost" onClick={onBack} style={{ padding: 0, gap: '6px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                <ArrowLeft size={16} /> Quay lại
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Chi tiết Feature View</h1>
                <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '12px' }}>ID: {detail.id.split('-')[0]}</span>
              </div>
            </div>

            {/* Edit / Save / Delete */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isEditing ? (
                <>
                  <button className="btn btn-secondary" onClick={() => setIsEditing(true)} style={{ gap: '8px' }}>
                    <Edit2 size={16} /> Chỉnh sửa
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowDeleteConfirm(true)} 
                    style={{ gap: '8px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
                  >
                    <Trash2 size={16} /> Xóa
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={handleCancelEdit} disabled={isSaving}><X size={16} /> Hủy</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <div className="spinner spinner-sm"></div> : <><Save size={16} /> Lưu thay đổi</>}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Metadata Card */}
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', background: 'var(--surface)', flexShrink: 0 }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Tag size={14} /> TÊN VIEW
              </label>
              {isEditing ? (
                <input type="text" className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
              ) : (
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{detail.name}</div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Clock size={14} /> THỜI GIAN TỒN TẠI (TTL)
              </label>
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" className="form-input" value={editTtl} onChange={e => setEditTtl(Number(e.target.value))} style={{ width: '120px' }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>giây</span>
                </div>
              ) : (
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{detail.ttl_seconds} giây</div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Fingerprint size={14} /> ENTITY
              </label>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>
                {detail.features.length > 0 ? detail.features[0].entity_name : 'N/A'}
              </div>
            </div>
          </div>

          {/* Materialization Jobs */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Activity size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Cập nhật vật lý hóa (Materialization Jobs)</h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {loadingJobs ? (
                  <div className="spinner" style={{ margin: '40px auto' }}></div>
              ) : jobs.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa có tiến trình vật lý hóa nào.
                  </div>
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {jobs.map(job => (
                          <div key={job.id} style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <span style={{ fontWeight: 600, fontSize: '14px' }}>Job ID: {job.id.split('-')[0]}</span>
                                      <StatusBadge execution={job.status} />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <Calendar size={14} /> Bắt đầu: {new Date(job.created_at * 1000).toLocaleString('vi-VN')}
                                      </span>
                                      {job.updated_at && (
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <Clock size={14} /> Cập nhật: {new Date(job.updated_at * 1000).toLocaleString('vi-VN')}
                                          </span>
                                      )}
                                  </div>
                                  {job.error_message && (
                                      <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', background: 'rgba(239, 68, 68, 0.05)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                          <strong>Lỗi:</strong> {job.error_message}
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
              
              {jobsTotalPages > 1 && (
                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                      <Pagination 
                          currentPage={jobsPage} 
                          totalPages={jobsTotalPages} 
                          onPageChange={setJobsPage} 
                      />
                  </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================
          CUSTOM DELETE CONFIRMATION MODAL
          ========================================================= */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: '#ef4444', 
                padding: '10px', 
                borderRadius: '50%',
                flexShrink: 0 
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>Cảnh báo xóa</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Bạn có chắc chắn muốn xóa vĩnh viễn Feature View <strong style={{ color: 'var(--text-primary)' }}>{detail.name}</strong> không? Hành động này không thể hoàn tác và có thể ảnh hưởng đến các ứng dụng đang gọi đến View này.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Hủy bỏ
              </button>
              <button 
                className="btn btn-primary" 
                onClick={executeDelete}
                disabled={isDeleting}
                style={{ background: '#ef4444', color: 'white', border: 'none' }}
              >
                {isDeleting ? <div className="spinner spinner-sm" /> : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
