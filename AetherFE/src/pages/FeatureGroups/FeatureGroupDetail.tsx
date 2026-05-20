import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Info, CheckCircle, XCircle, Code2, Settings, Zap } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { studioApi } from '@/services/studio';
import { useNotification } from '@/components/ui/Notification';
import { Toggle } from '@/components/ui/Toggle';
import type { FeatureGroupDetail as IFeatureGroupDetail, FeatureGroupStatus, ScheduleInterval } from '@/types';
import { FeatureGroupFeatures } from '@/pages/FeatureGroups/FeatureGroupFeatures';

export const FeatureGroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [featureGroup, setFeatureGroup] = useState<IFeatureGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'config' | 'transformation' | 'streaming'>('config');

  // Form state
  const [isScheduled, setIsScheduled] = useState(false);
  const [cronExpression, setCronExpression] = useState('');
  const [status, setStatus] = useState<FeatureGroupStatus>('ACTIVE');
  const [isSaving, setIsSaving] = useState(false);

  // Streaming state
  const [isStreamingLoading, setIsStreamingLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await studioApi.getFeatureGroup(id);

        const detail = res.data;

        if (isMounted) {
          if (detail) {
            setFeatureGroup(detail);
            setIsScheduled(detail.is_scheduled || false);
            setCronExpression(detail.cron_expression || 'DAILY');
            setStatus(detail.status);
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

    if (isScheduled && featureGroup.last_run_status !== 'COMPLETED') {
      showNotification('error', 'Không thể lập lịch khi trạng thái chạy cuối không phải là COMPLETED');
      return;
    }

    if (isScheduled && status === 'INACTIVE') {
      showNotification('error', 'Không thể lập lịch khi trạng thái là INACTIVE');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await studioApi.updateFeatureGroup(featureGroup.id, {
        is_scheduled: isScheduled,
        cron_expression: isScheduled ? cronExpression as ScheduleInterval : undefined,
        status: status
      });
      // Need to re-fetch the detailed feature group or merge updates
      const updatedDetail = await studioApi.getFeatureGroup(featureGroup.id);
      setFeatureGroup({ ...updated.data, ...updatedDetail.data } as IFeatureGroupDetail);
      showNotification('success', 'Đã lưu cấu hình');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableStreaming = async () => {
    if (!featureGroup) return;
    try {
      setIsStreamingLoading(true);
      const res = await studioApi.enableStreaming(featureGroup.id);
      setFeatureGroup({ ...featureGroup, streaming_data: res.data });
      showNotification('success', 'Đã kích hoạt Streaming Source');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Lỗi khi kích hoạt streaming');
    } finally {
      setIsStreamingLoading(false);
    }
  };

  const handleDisableStreaming = async () => {
    if (!featureGroup) return;
    try {
      setIsStreamingLoading(true);
      await studioApi.disableStreaming(featureGroup.id);
      setFeatureGroup({ ...featureGroup, streaming_data: null });
      showNotification('success', 'Đã tắt Streaming Source');
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Lỗi khi tắt streaming');
    } finally {
      setIsStreamingLoading(false);
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
        <FeatureGroupFeatures features={featureGroup.features || []} />
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
          {featureGroup.status === 'ACTIVE' && featureGroup.last_run_status === 'COMPLETED' && (
            <button
              onClick={() => setActiveTab('streaming')}
              style={{
                background: 'none', border: 'none', padding: '12px 0', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                color: activeTab === 'streaming' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'streaming' ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              <Zap size={16} /> Streaming Source
            </button>
          )}
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
                      <option value="HOURLY">Hàng giờ</option>
                      <option value="DAILY">Hàng ngày</option>
                      <option value="WEEKLY">Hàng tuần</option>
                      <option value="MONTHLY">Hàng tháng</option>
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
                    <li>Không thể lập lịch nếu trạng thái chạy cuối không phải là COMPLETED.</li>
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

            <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <Editor
                height="100%"
                language={featureGroup.transformation?.t_type === 'SQL' ? 'sql' : 'python'}
                theme="vs-dark"
                value={featureGroup.transformation?.definition || '-- Logic biến đổi sẽ hiển thị tại đây...'}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, padding: { top: 16, bottom: 16 } }}
              />
            </div>
          </div>
        )}

        {/* TAB CONTENT: STREAMING SOURCE */}
        {activeTab === 'streaming' && featureGroup.status === 'ACTIVE' && featureGroup.last_run_status === 'COMPLETED' && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Streaming Source</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tiếp nhận dữ liệu thời gian thực thông qua Kafka</p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {featureGroup.streaming_data ? (
                  <>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                      Streaming: Active
                    </span>
                    <button
                      className="btn btn-outline"
                      style={{ color: '#ef4444', borderColor: '#ef4444' }}
                      onClick={handleDisableStreaming}
                      disabled={isStreamingLoading}
                    >
                      {isStreamingLoading ? <div className="spinner spinner-sm" style={{ borderColor: '#ef4444', borderTopColor: 'transparent' }} /> : 'Tắt Streaming'}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="badge" style={{ background: 'var(--surface)', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-secondary)', display: 'inline-block' }}></span>
                      Streaming: Inactive
                    </span>
                    <button
                      className="btn btn-primary"
                      onClick={handleEnableStreaming}
                      disabled={isStreamingLoading}
                    >
                      {isStreamingLoading ? <div className="spinner spinner-sm" /> : 'Kích hoạt Streaming'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {featureGroup.streaming_data ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px', flexShrink: 0 }}>
                  <Info size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#3b82f6', marginBottom: '4px', fontSize: '14px' }}>Hướng dẫn gửi dữ liệu</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Đoạn mã bên dưới sử dụng <strong>confluent-kafka</strong> làm ví dụ (<code>pip install confluent-kafka</code>). Tuy nhiên, bạn không nhất thiết phải dùng thư viện này; bạn có thể sử dụng bất kỳ Kafka client nào khác để đẩy dữ liệu.
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <button
                    onClick={() => {
                      const code = `import json\nfrom confluent_kafka import Producer\n\ndef send_streaming_data():\n    # Khởi tạo Kafka Producer kết nối tới hệ thống AetherFS\n    conf = {\n        'bootstrap.servers': '${featureGroup.streaming_data?.bootstrap_servers}',\n        'client.id': 'aether_streaming_producer'\n    }\n    producer = Producer(conf)\n    \n    # Callback để nhận thông báo khi gửi thành công hoặc thất bại\n    def delivery_report(err, msg):\n        if err is not None:\n            print(f"Lỗi khi gửi dữ liệu: {err}")\n        else:\n            print(f"Đã gửi dữ liệu thành công tới Topic {msg.topic()} [Partition {msg.partition()}]")\n\n    try:\n        # Dữ liệu mẫu (Thay thế bằng cấu trúc thực tế của bạn)\n        data = {\n            # Điền các field tương ứng với schema của entity và feature group\n            "id": 1,\n            "feature_value": 100\n        }\n        \n        # Serialize dữ liệu sang JSON byte\n        json_data = json.dumps(data).encode('utf-8')\n        \n        # Gửi dữ liệu vào Topic\n        producer.produce('${featureGroup.streaming_data?.topic_name}', value=json_data, callback=delivery_report)\n        \n        # Đợi các message trong hàng đợi được gửi đi\n        producer.flush()\n    except Exception as e:\n        print(f"Có lỗi xảy ra: {e}")\n\nif __name__ == "__main__":\n    send_streaming_data()`;
                      navigator.clipboard.writeText(code);
                      showNotification('success', 'Đã copy code mẫu!');
                    }}
                    style={{ position: 'absolute', top: '12px', right: '24px', zIndex: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Code2 size={14} /> Copy Code
                  </button>
                  <Editor
                    height="100%"
                    language="python"
                    theme="vs-dark"
                    value={`import json
from confluent_kafka import Producer

def send_streaming_data():
    # Khởi tạo Kafka Producer kết nối tới hệ thống AetherFS
    conf = {
        'bootstrap.servers': '${featureGroup.streaming_data?.bootstrap_servers}',
        'client.id': 'aether_streaming_producer'
    }
    producer = Producer(conf)
    
    # Callback để nhận thông báo khi gửi thành công hoặc thất bại
    def delivery_report(err, msg):
        if err is not None:
            print(f"Lỗi khi gửi dữ liệu: {err}")
        else:
            print(f"Đã gửi dữ liệu thành công tới Topic {msg.topic()} [Partition {msg.partition()}]")

    try:
        # Dữ liệu mẫu (Thay thế bằng cấu trúc thực tế của bạn)
        data = {
            # Điền các field tương ứng với schema của entity và feature group
            "id": 1,
            "feature_value": 100
        }
        
        # Serialize dữ liệu sang JSON byte
        json_data = json.dumps(data).encode('utf-8')
        
        # Gửi dữ liệu vào Topic
        producer.produce('${featureGroup.streaming_data?.topic_name}', value=json_data, callback=delivery_report)
        
        # Đợi các message trong hàng đợi được gửi đi
        producer.flush()
    except Exception as e:
        print(f"Có lỗi xảy ra: {e}")

if __name__ == "__main__":
    send_streaming_data()`}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, padding: { top: 16, bottom: 16 } }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <Zap size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Streaming chưa được kích hoạt</h4>
                <p style={{ fontSize: '14px', maxWidth: '400px', textAlign: 'center', lineHeight: 1.5 }}>
                  Kích hoạt Streaming Source để mở luồng nhận dữ liệu thời gian thực. Hệ thống sẽ cung cấp endpoint Kafka để bạn đẩy dữ liệu vào.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
