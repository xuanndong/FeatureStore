import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Database, FolderTree, Code2, ChevronDown, ChevronUp, Check, Info } from 'lucide-react';

import { registryApi } from '@/services/registry';
import { studioApi } from '@/services/studio';
import { useNotification } from '@/components/ui/Notification';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toggle } from '@/components/ui/Toggle';
import type {
  EntityOption, DataSourceOption, SourceFormat,
  TransformationType, ScheduleInterval, WizardEntityStep,
  WizardSourceStep, WizardTransformStep
} from '@/types';

export const CreateFeatureGroupWizard: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // --- Step 1: Entity ---
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [entityStep, setEntityStep] = useState<WizardEntityStep>({});
  const [entityExpand, setEntityExpand] = useState<'choose' | 'create' | null>('choose');

  // --- Step 2: Source ---
  const [sourceOptions, setSourceOptions] = useState<DataSourceOption[]>([]);
  const [sourceStep, setSourceStep] = useState<WizardSourceStep>({
    new_source_config: {
      name: '', source_type: 'BATCH', source_format: 'PARQUET', location_uri: ''
    }
  });
  const [sourceExpand, setSourceExpand] = useState<'choose' | 'create' | null>('choose');
  const [isCheckingSource, setIsCheckingSource] = useState(false);

  // --- Step 3: Transformation ---
  const [transformStep, setTransformStep] = useState<WizardTransformStep>({
    transformation_name: '',
    transform_type: 'SQL',
    transform_definition: '-- Viết logic biến đổi SQL tại đây\nSELECT * FROM source_data;',
    previewOk: false
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);

  // --- Finish Modal ---
  const [fgName, setFgName] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [cronExp, setCronExp] = useState<ScheduleInterval>('daily');

  // Fetch initial options
  useEffect(() => {
    registryApi.getEntityOptions().then(res => setEntityOptions(res.data)).catch(console.error);
    registryApi.getSourceOptions().then(res => setSourceOptions(res.data)).catch(console.error);
  }, []);

  // Handlers for Step 1
  const isStep1Valid = () => {
    if (entityStep.entity_id) return true;
    if (entityStep.new_entity_config?.name && entityStep.new_entity_config?.join_key) return true;
    return false;
  };

  // Handlers for Step 2
  const handleCheckSource = async () => {
    if (!sourceStep.new_source_config?.location_uri) return;
    try {
      setIsCheckingSource(true);
      await registryApi.testConnection({ location_uri: sourceStep.new_source_config.location_uri });
      setSourceStep(prev => ({ ...prev, connectionChecked: true }));
      showNotification('success', 'Kiểm tra kết nối thành công!');
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi kết nối');
      setSourceStep(prev => ({ ...prev, connectionChecked: false }));
    } finally {
      setIsCheckingSource(false);
    }
  };

  const isStep2Valid = () => {
    if (sourceStep.source_id) return true;
    if (sourceStep.new_source_config?.name && sourceStep.connectionChecked) return true;
    return false;
  };

  // Handlers for Step 3
  const handleRunScript = async () => {
    try {
      setIsPreviewing(true);
      const res = await studioApi.previewTransformation({
        source_id: sourceStep.source_id,
        new_source_config: sourceStep.source_id ? undefined : sourceStep.new_source_config,
        transform_type: transformStep.transform_type,
        transform_definition: transformStep.transform_definition,
        limit: 10
      });
      setPreviewResult(res.data.preview_data);
      setTransformStep(prev => ({ ...prev, previewOk: true, inferredFeatures: res.data.inferred_features }));
      showNotification('success', 'Chạy script thành công!');
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi khi chạy script');
      setTransformStep(prev => ({ ...prev, previewOk: false }));
    } finally {
      setIsPreviewing(false);
    }
  };

  const isStep3Valid = () => {
    return transformStep.transformation_name.trim().length > 0 && transformStep.previewOk;
  };

  // Submit
  const handleFinish = async () => {
    if (!fgName) {
      showNotification('error', 'Vui lòng nhập tên Feature Group');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = {
        name: fgName,
        entity_id: entityStep.entity_id,
        new_entity_config: entityStep.entity_id ? undefined : entityStep.new_entity_config,
        source_id: sourceStep.source_id,
        new_source_config: sourceStep.source_id ? undefined : sourceStep.new_source_config,
        transformation_name: transformStep.transformation_name,
        transform_type: transformStep.transform_type,
        transform_definition: transformStep.transform_definition,
        features: transformStep.inferredFeatures || [],
        is_scheduled: isScheduled,
        cron_expression: isScheduled ? cronExp : undefined
      };
      await studioApi.createFeatureGroup(payload);
      showNotification('success', 'Tạo Feature Group thành công!');
      navigate('/feature-groups');
    } catch (err: any) {
      showNotification('error', err.message || 'Lỗi khi tạo Feature Group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px', gap: '20px' }}>
      {[
        { num: 1, icon: Database, label: 'THỰC THỂ' },
        { num: 2, icon: FolderTree, label: 'NGUỒN DỮ LIỆU' },
        { num: 3, icon: Code2, label: 'LOGIC BIẾN ĐỔI' }
      ].map((s, i) => (
        <React.Fragment key={s.num}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: step >= s.num ? 1 : 0.4 }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: step === s.num ? '#1a1f36' : step > s.num ? 'var(--primary)' : 'var(--surface)',
              color: step === s.num ? 'white' : step > s.num ? 'white' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {step > s.num ? <Check size={20} /> : <s.icon size={20} />}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</span>
          </div>
          {i < 2 && (
            <div style={{ flex: 1, height: '1px', background: 'var(--border)', maxWidth: '100px', opacity: step > s.num ? 1 : 0.4 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Trình tạo Feature Group</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Kết nối các thực thể, nguồn dữ liệu và logic biến đổi để định nghĩa một Feature Group mới trong Aether Registry.</p>
      </div>

      <StepIndicator />

      <div className="card" style={{ padding: '0' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
              {step === 1 ? 'Thực thể' : step === 2 ? 'Nguồn dữ liệu' : 'Logic biến đổi'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {step === 1 ? 'Định nghĩa thực thể gốc cho tập dữ liệu này.' :
                step === 2 ? 'Thiết lập kết nối đến hạ tầng dữ liệu của bạn để bắt đầu trích xuất features.' :
                  'Công thức tính toán hoặc mã xử lý để biến đổi dữ liệu thô thành các đặc trưng có giá trị.'}
            </p>
          </div>
          <div style={{ background: 'var(--surface)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
            BƯỚC {step} / 3
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>

          {/* --- STEP 1 CONTENT --- */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Choose Existing */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: entityExpand === 'choose' ? 'var(--surface-hover)' : 'transparent' }}
                  onClick={() => { setEntityExpand('choose'); setEntityStep({ entity_id: entityStep.entity_id }); }}
                >
                  <span style={{ fontWeight: 600 }}>Chọn thực thể</span>
                  {entityExpand === 'choose' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {entityExpand === 'choose' && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                    <select
                      className="form-select"
                      value={entityStep.entity_id || ''}
                      onChange={e => setEntityStep({ entity_id: e.target.value })}
                    >
                      <option value="">Chọn một thực thể...</option>
                      {entityOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <p className="form-hint">Thực thể xác định cách dữ liệu sẽ được liên kết và truy vấn trong Online Store.</p>
                  </div>
                )}
              </div>

              {/* Create New */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: entityExpand === 'create' ? 'var(--surface-hover)' : 'transparent' }}
                  onClick={() => {
                    setEntityExpand('create');
                    setEntityStep({ new_entity_config: { name: '', join_key: '', description: '' } });
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Tạo thực thể</span>
                  {entityExpand === 'create' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {entityExpand === 'create' && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label className="form-label">Tên thực thể</label>
                      <input
                        type="text" className="form-input" placeholder="Ví dụ: customer, device_log"
                        value={entityStep.new_entity_config?.name || ''}
                        onChange={e => setEntityStep({ new_entity_config: { ...entityStep.new_entity_config!, name: e.target.value } })}
                      />
                      <p className="form-hint">Chỉ sử dụng chữ thường, số và dấu gạch dưới.</p>
                    </div>
                    <div>
                      <label className="form-label">Khóa liên kết</label>
                      <input
                        type="text" className="form-input" placeholder="Ví dụ: user_id"
                        value={entityStep.new_entity_config?.join_key || ''}
                        onChange={e => setEntityStep({ new_entity_config: { ...entityStep.new_entity_config!, join_key: e.target.value } })}
                      />
                      <p className="form-hint">Khóa chính được sử dụng để ghép nối.</p>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Mô tả chi tiết</label>
                      <textarea
                        className="form-textarea" placeholder="Mô tả mục đích..."
                        value={entityStep.new_entity_config?.description || ''}
                        onChange={e => setEntityStep({ new_entity_config: { ...entityStep.new_entity_config!, description: e.target.value } })}
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* --- STEP 2 CONTENT --- */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Choose Existing Source */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: sourceExpand === 'choose' ? 'var(--surface-hover)' : 'transparent' }}
                  onClick={() => { setSourceExpand('choose'); setSourceStep({ source_id: sourceStep.source_id }); }}
                >
                  <span style={{ fontWeight: 600 }}>Chọn nguồn dữ liệu</span>
                  {sourceExpand === 'choose' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {sourceExpand === 'choose' && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
                    <select
                      className="form-select"
                      value={sourceStep.source_id || ''}
                      onChange={e => setSourceStep({ source_id: e.target.value })}
                    >
                      <option value="">Chọn một nguồn dữ liệu...</option>
                      {sourceOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Create New Source */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div
                  style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: sourceExpand === 'create' ? 'var(--surface-hover)' : 'transparent' }}
                  onClick={() => {
                    setSourceExpand('create');
                    setSourceStep({ new_source_config: { name: '', source_type: 'BATCH', source_format: 'PARQUET', location_uri: '' } });
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Tạo nguồn dữ liệu</span>
                  {sourceExpand === 'create' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {sourceExpand === 'create' && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label className="form-label">Loại nguồn</label>
                      <select disabled className="form-select"><option>BATCH</option></select>
                    </div>
                    <div>
                      <label className="form-label">Định dạng</label>
                      <select
                        className="form-select"
                        value={sourceStep.new_source_config?.source_format || 'PARQUET'}
                        onChange={e => setSourceStep({ new_source_config: { ...sourceStep.new_source_config!, source_format: e.target.value as SourceFormat } })}
                      >
                        <option value="PARQUET">Apache Parquet</option>
                        <option value="CSV">CSV</option>
                        <option value="JSON">JSON</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Tên Nguồn (Unique Name)</label>
                      <input
                        type="text" className="form-input" placeholder="vd: production_user_logs_v2"
                        value={sourceStep.new_source_config?.name || ''}
                        onChange={e => setSourceStep({ new_source_config: { ...sourceStep.new_source_config!, name: e.target.value }, connectionChecked: false })}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label className="form-label">Vị trí kết nối (Location URI)</label>
                        <input
                          type="text" className="form-input" placeholder="s3://bucket-name/path/to/data/"
                          value={sourceStep.new_source_config?.location_uri || ''}
                          onChange={e => setSourceStep({ new_source_config: { ...sourceStep.new_source_config!, location_uri: e.target.value }, connectionChecked: false })}
                        />
                      </div>
                      <button className="btn btn-secondary" onClick={handleCheckSource} disabled={isCheckingSource}>
                        {isCheckingSource ? <div className="spinner spinner-sm"></div> : 'Kiểm tra'}
                      </button>
                    </div>
                    {sourceStep.connectionChecked && <div style={{ color: '#10b981', fontSize: '13px', gridColumn: '1 / -1' }}>✓ Kết nối thành công</div>}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* --- STEP 3 CONTENT --- */}
          {step === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }}>
              <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <Editor
                  height="100%"
                  language={transformStep.transform_type === 'SQL' ? 'sql' : 'python'}
                  theme="vs-dark"
                  value={transformStep.transform_definition}
                  onChange={(val) => setTransformStep({ ...transformStep, transform_definition: val || '', previewOk: false })}
                  options={{ minimap: { enabled: false }, fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleRunScript} disabled={isPreviewing}>
                  {isPreviewing ? <div className="spinner spinner-sm"></div> : '▶ Run Script'}
                </button>
                <div>
                  <label className="form-label">TYPE</label>
                  <select
                    className="form-select"
                    value={transformStep.transform_type}
                    onChange={(e) => setTransformStep({ ...transformStep, transform_type: e.target.value as TransformationType, previewOk: false })}
                  >
                    <option value="SQL">SQL</option>
                    <option value="PYTHON_UDF">Python UDF</option>
                    <option value="AGGREGATION">Aggregation</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">TRANSFORMATION NAME</label>
                  <input
                    type="text" className="form-input" placeholder="user_daily_activity"
                    value={transformStep.transformation_name}
                    onChange={(e) => setTransformStep({ ...transformStep, transformation_name: e.target.value })}
                  />
                </div>
                {transformStep.previewOk && <div style={{ color: '#10b981', fontSize: '13px' }}>✓ Script hợp lệ</div>}
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
          <button className="btn btn-ghost" onClick={() => step > 1 ? setStep((step - 1) as any) : setShowCancelModal(true)}>
            Quay lại
          </button>
          {step < 3 ? (
            <button
              className="btn btn-secondary"
              onClick={() => setStep((step + 1) as any)}
              disabled={step === 1 ? !isStep1Valid() : !isStep2Valid()}
              style={{ background: '#8a94b0', color: 'white', border: 'none' }}
            >
              Tiếp theo →
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => setShowFinishModal(true)}
              disabled={!isStep3Valid()}
              style={{ background: '#8a94b0', color: 'white', border: 'none' }}
            >
              Hoàn thành →
            </button>
          )}
        </div>
      </div>

      {/* Cancel Confirmation */}
      <ConfirmModal
        isOpen={showCancelModal}
        title="Hủy quá trình"
        message="Bạn có chắc chắn muốn hủy? Mọi thay đổi sẽ bị xóa."
        confirmText="Đồng ý"
        onCancel={() => setShowCancelModal(false)}
        onConfirm={() => {
          showNotification('info', 'Đã hủy quá trình tạo.');
          navigate('/feature-groups');
        }}
      />

      {/* Finish / Schedule Modal */}
      {showFinishModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Feature Group</h3>
              <button className="modal-close" onClick={() => setShowFinishModal(false)}><span style={{ fontSize: '20px' }}>×</span></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
              <div>
                <label className="form-label">Tên Feature Group <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text" className="form-input" placeholder="Nhập tên feature group..."
                  value={fgName} onChange={e => setFgName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Tự động lập lịch (Schedule)</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bật để tự động cập nhật dữ liệu định kỳ</div>
                </div>
                <Toggle checked={isScheduled} onChange={setIsScheduled} />
              </div>

              {isScheduled && (
                <div>
                  <label className="form-label">Cron Expression</label>
                  <select className="form-select" value={cronExp} onChange={e => setCronExp(e.target.value as ScheduleInterval)}>
                    <option value="daily">DAILY (daily)</option>
                    <option value="hourly">HOURLY (hourly)</option>
                    <option value="1_week">WEEKLY (weekly)</option>
                    <option value="1_month">MONTHLY (monthly)</option>
                    <option value="3_months">QUARTERLY (quarterly)</option>
                  </select>
                  <div style={{ color: 'var(--primary)', fontSize: '12px', marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Info size={14} /> Current Time: {new Date().toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface)', padding: '16px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '24px', display: 'flex', gap: '8px' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                • Nếu last_run_status là FAILED, hệ thống sẽ tự động tắt lập lịch.<br />
                • Feature Group ở trạng thái Deprecated/Inactive sẽ không được phép lập lịch.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-ghost" onClick={() => setShowFinishModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleFinish} disabled={isSubmitting}>
                {isSubmitting ? <div className="spinner spinner-sm"></div> : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Result Modal overlay */}
      {previewResult && (
        <div className="modal-overlay" onClick={() => setPreviewResult(null)}>
          <div className="modal-box" style={{ maxWidth: '800px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Kết quả Preview</h3>
              <button className="modal-close" onClick={() => setPreviewResult(null)}><span style={{ fontSize: '20px' }}>×</span></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#1e1e1e', color: '#d4d4d4', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px' }}>
              <pre>{JSON.stringify(previewResult, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
