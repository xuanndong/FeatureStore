import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { useNotification } from '@/components/ui/Notification';
import { studioApi } from '@/services/studio';
import type { FeatureGroup, ScheduleInterval, FeatureGroupStatus } from '@/types';

export const FeatureGroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [data, setData] = useState<FeatureGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [isScheduled, setIsScheduled] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<FeatureGroupStatus>('ACTIVE');
  const [cronExp, setCronExp] = useState<ScheduleInterval | ''>('');

  useEffect(() => {
    if (!id) return;
    // Note: there is no GET /feature-groups/:id in the provided studio router.
    // I will mock this for now, or if it exists, uncomment real call.
    // Instead of failing, we will simulate a fetch using list endpoint or empty fallback.
    const fetchDetail = async () => {
      try {
        setLoading(true);
        // Fallback: list all and find it
        const res = await studioApi.listFeatureGroups();
        const found = res.data.items.find(x => x.id === id);
        if (found) {
          setData(found);
          setIsScheduled(found.is_scheduled);
          setLifecycleStatus(found.status);
          setCronExp(found.cron_expression || '');
        } else {
          showNotification('error', 'Không tìm thấy chi tiết nhóm đặc trưng');
        }
      } catch (err: any) {
        showNotification('error', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id, showNotification]);

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await studioApi.updateFeatureGroup(id, {
        is_scheduled: isScheduled,
        status: lifecycleStatus,
        cron_expression: isScheduled ? (cronExp as ScheduleInterval) : undefined
      });
      showNotification('success', 'Cập nhật thành công!');
      navigate('/feature-groups');
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner" style={{ margin: '100px auto' }}></div>;
  if (!data) return <div className="empty-state">Không có dữ liệu</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-ghost" style={{ padding: '8px', borderRadius: '4px' }} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Chi tiết Feature Group</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Cấu hình lịch trình và vòng đời cho nhóm đặc trưng này</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner spinner-sm"></div> : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>

        {/* Main config panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Enable Scheduling</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tự động chạy các tác vụ cụ thể hóa dữ liệu</p>
            </div>
            <Toggle checked={isScheduled} onChange={setIsScheduled} />
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Lifecycle Status</label>
              <select
                className="form-select"
                value={lifecycleStatus}
                onChange={(e) => setLifecycleStatus(e.target.value as FeatureGroupStatus)}
              >
                <option value="ACTIVE">Active</option>
                <option value="DEPRECATED">Deprecated</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cron Expression</label>
              <select
                className="form-select"
                value={cronExp}
                onChange={(e) => setCronExp(e.target.value as ScheduleInterval)}
                disabled={!isScheduled}
              >
                <option value="">Chọn tần suất...</option>
                <option value="hourly">HOURLY (mỗi giờ)</option>
                <option value="daily">DAILY (mỗi ngày)</option>
                <option value="1_week">WEEKLY (mỗi tuần)</option>
                <option value="1_month">MONTHLY (mỗi tháng)</option>
                <option value="3_months">QUARTERLY (mỗi quý)</option>
              </select>
              {isScheduled && (
                <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Clock size={14} /> Current Time: {new Date().toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="info-box" style={{ flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
              <Info size={16} /> Quy tắc lập lịch
            </div>
            <ul style={{ paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Các lượt chạy thất bại sẽ tự động vô hiệu hóa lập lịch để ngăn chặn lỗi dữ liệu</li>
              <li>Không thể lập lịch cho các nhóm đã ngưng hỗ trợ hoặc không hoạt động</li>
              <li>Các biểu thức Cron được ánh xạ sang các khoảng thời gian nội bộ</li>
            </ul>
          </div>
        </div>

        {/* Right metadata panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>METADATA</h3>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Group Name</div>
            <div style={{ fontWeight: 500 }}>{data.name}</div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Offline URI</div>
            <div style={{ background: 'var(--surface)', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              s3://aether-platform/features/{data.name.toLowerCase()}/v1
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Last Run Status</div>
            <span className={`badge ${data.last_run_status === 'COMPLETED' ? 'badge-success' : data.last_run_status === 'FAILED' ? 'badge-failed' : 'badge-pending'}`}>
              {data.last_run_status}
            </span>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Created At</div>
            <div style={{ fontSize: '13px' }}>{new Date(data.created_at * 1000).toLocaleDateString()}</div>
          </div>
        </div>

      </div>
    </div>
  );
};

import { Info, Clock } from 'lucide-react';
