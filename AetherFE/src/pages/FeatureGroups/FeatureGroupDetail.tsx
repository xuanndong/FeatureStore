import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Info, CheckCircle, XCircle, Code2, Settings } from 'lucide-react';
import { studioApi } from '@/services/studio';
import { useNotification } from '@/components/ui/Notification';
import { Toggle } from '@/components/ui/Toggle';
import type { FeatureGroup, FeatureGroupStatus, ScheduleInterval } from '@/types';
import { FeatureGroupFeatures } from '@/pages/FeatureGroups/FeatureGroupFeatures';

export const FeatureGroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [featureGroup, setFeatureGroup] = useState<FeatureGroup | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'config' | 'transformation'>('config');

  // Form state
  const [isScheduled, setIsScheduled] = useState(false);
  const [cronExpression, setCronExpression] = useState('');
  const [status, setStatus] = useState<FeatureGroupStatus>('ACTIVE');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await studioApi.listFeatureGroups(undefined, undefined, 1, 100);
        const found = res.data.items.find(g => g.id === id);
        if (isMounted) {
          if (found) {
            setFeatureGroup(found);
            setIsScheduled(found.is_scheduled);
            setCronExpression(found.cron_expression || 'daily');
            setStatus(found.status);
          } else {
            showNotification('error', 'Không tìm thấy Feature Group');
            navigate('/feature-groups');
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          showNotification('error', err instanceof Error ? err.message : 'Lỗi khi tải chi tiết Feature Group');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDetail();
    return () => { isMounted = false; };
  }, [id, navigate, showNotification]);

  const handleSave = async () => {
    if (!featureGroup) return;
    try {
      setIsSaving(true);
      const updated = await studioApi.updateFeatureGroup(featureGroup.id, {
        is_scheduled: isScheduled,
        cron_expression: isScheduled ? cronExpression as ScheduleInterval : undefined,
        status: status
      });
      setFeatureGroup(updated.data);
      showNotification('success', 'Đã lưu cấu hình');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!featureGroup) return null;

  return (
    <div style={{ 
      display: 'flex', 
      flex: 1,
      height: '100%',
      minHeight: 0,
      width: '100%',
      background: 'var(--bg)',
      overflow: 'hidden'
    }}>
      
      {/* LEFT: Features List (Sidebar) */}
      <div style={{ 
        flex: '0 0 300px',
        height: '100%', 
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        background: 'var(--surface)'
      }}>
        <FeatureGroupFeatures groupId={featureGroup.id} />
      </div>

      {/* RIGHT: Main Content */}
      <div style={{ 
        flex: 1, 
        padding: '32px', 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto'
      }}>
        
        {/* Header Area */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{featureGroup.name}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Phiên bản: v{featureGroup.version}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/feature-groups')}>Quay lại</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <div className="spinner spinner-sm" /> : 'Lưu cấu hình'}
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px', gap: '32px', flexShrink: 0 }}>
          <button 
            onClick={() => setActiveTab('config')}
            style={{ 
              background: 'none', border: 'none', padding: '12px 0', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              color: activeTab === 'config' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'config' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            <Settings size={16} /> Cấu hình & Metadata
          </button>
          <button 
            onClick={() => setActiveTab('transformation')}
            style={{ 
              background: 'none', border: 'none', padding: '12px 0', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              color: activeTab === 'transformation' ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'transformation' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            <Code2 size={16} /> Logic biến đổi (Transformation)
          </button>
        </div>

        {/* TAB CONTENT: CONFIG & METADATA */}
        {activeTab === 'config' && (
          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>Tự động lập lịch</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Chạy các tác vụ cụ thể hóa dữ liệu</div>
                  </div>
                  <Toggle checked={isScheduled} onChange={setIsScheduled} />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label className="form-label">Trạng thái</label>
                  <select className="form-select" value={status} onChange={e => setStatus(e.target.value as FeatureGroupStatus)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DEPRECATED">DEPRECATED</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                {isScheduled && (
                  <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                    <label className="form-label">Chu kỳ chạy</label>
                    <select className="form-select" value={cronExpression} onChange={e => setCronExpression(e.target.value)}>
                      <option value="daily">Hàng ngày</option>
                      <option value="hourly">Hàng giờ</option>
                      <option value="1_week">Hàng tuần</option>
                      <option value="1_month">Hàng tháng</option>
                    </select>
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>Quy tắc hệ thống</div>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>Thất bại hệ thống sẽ tự động vô hiệu hóa lịch chạy.</li>
                    <li>Không thể lập lịch nếu trạng thái là INACTIVE.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="card" style={{ height: 'fit-content' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '20px', letterSpacing: '0.05em' }}>THÔNG TIN THỰC THI</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div className="form-label">Lần chạy cuối</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: featureGroup.last_run_status === 'COMPLETED' ? 'var(--exec-success-bg)' : featureGroup.last_run_status === 'FAILED' ? 'var(--exec-failed-bg)' : 'var(--exec-pending-bg)', color: featureGroup.last_run_status === 'COMPLETED' ? 'var(--exec-success-text)' : featureGroup.last_run_status === 'FAILED' ? 'var(--exec-failed-text)' : 'var(--exec-pending-text)' }}>
                    {featureGroup.last_run_status === 'COMPLETED' ? <CheckCircle size={14} /> : featureGroup.last_run_status === 'FAILED' ? <XCircle size={14} /> : <Clock size={14} />}
                    {featureGroup.last_run_status || 'PENDING'}
                  </div>
                </div>

                <div>
                  <div className="form-label">Ngày tạo</div>
                  <div style={{ fontSize: '13px' }}>{new Date(featureGroup.created_at * 1000).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: TRANSFORMATION */}
        {activeTab === 'transformation' && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Mã nguồn logic</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Mã nguồn được liên kết từ Logic Library</p>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span className="badge" style={{ background: 'var(--surface)', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '12px' }}>
                  {featureGroup.transformation?.t_type || 'SQL'}
                </span>
              </div>
            </div>
            
            <div style={{ 
              background: '#1e1e1e', 
              color: '#d4d4d4', 
              padding: '20px', 
              borderRadius: '8px', 
              fontFamily: '"Fira Code", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              overflowX: 'auto',
              flex: 1
            }}>
              <pre style={{ margin: 0 }}>
                <code>
                  {featureGroup.transformation?.definition || '-- Logic biến đổi sẽ hiển thị tại đây...'}
                </code>
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
