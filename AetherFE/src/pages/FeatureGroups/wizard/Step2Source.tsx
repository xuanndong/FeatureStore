import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HardDrive, Cloud } from 'lucide-react';
import type { DataSourceOption, WizardSourceStep, SourceFormat } from '@/types';

interface Step2SourceProps {
  sourceOptions: DataSourceOption[];
  sourceStep: WizardSourceStep & { connectionError?: string | null };
  sourceExpand: 'choose' | 'create' | null;
  isCheckingSource: boolean;
  onExpandChange: (mode: 'choose' | 'create') => void;
  onStepChange: (step: any) => void;
  onCheckSource: () => void;
}

export const Step2Source: React.FC<Step2SourceProps> = React.memo(({
  sourceOptions, sourceStep, sourceExpand, isCheckingSource,
  onExpandChange, onStepChange, onCheckSource,
}) => {
  const [protocol, setProtocol] = useState<'local' | 's3'>(
    sourceStep.new_source_config?.location_uri?.startsWith('s3://') ? 's3' : 'local'
  );

  const handleProtocolChange = (type: 'local' | 's3') => {
    setProtocol(type);
    const prefix = type === 's3' ? 's3://' : '/';
    onStepChange({
      ...sourceStep,
      new_source_config: { 
        ...sourceStep.new_source_config!, 
        location_uri: prefix,
        // Reset options is local
        connection_options: type === 'local' ? undefined : sourceStep.new_source_config?.connection_options 
      },
      connectionChecked: false,
      connectionError: null
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* --- Choose Existing Source --- */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <div
          style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: sourceExpand === 'choose' ? 'var(--surface-hover)' : 'transparent' }}
          onClick={() => onExpandChange('choose')}
        >
          <span style={{ fontWeight: 600 }}>Chọn nguồn dữ liệu sẵn có</span>
          {sourceExpand === 'choose' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {sourceExpand === 'choose' && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
            <select
              className="form-select"
              value={sourceStep.source_id || ''}
              onChange={e => onStepChange({ source_id: e.target.value })}
            >
              <option value="">Chọn một nguồn dữ liệu...</option>
              {sourceOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* --- Create New Source --- */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <div
          style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: sourceExpand === 'create' ? 'var(--surface-hover)' : 'transparent' }}
          onClick={() => onExpandChange('create')}
        >
          <span style={{ fontWeight: 600 }}>Đăng ký nguồn mới</span>
          {sourceExpand === 'create' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {sourceExpand === 'create' && (
          <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Storage Type Selector */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className={`btn ${protocol === 'local' ? 'btn-primary' : 'btn-ghost'}`} 
                style={{ flex: 1, gap: '8px' }}
                onClick={() => handleProtocolChange('local')}
              >
                <HardDrive size={18} /> Local FS
              </button>
              <button 
                className={`btn ${protocol === 's3' ? 'btn-primary' : 'btn-ghost'}`} 
                style={{ flex: 1, gap: '8px' }}
                onClick={() => handleProtocolChange('s3')}
              >
                <Cloud size={18} /> S3 / MinIO
              </button>
            </div>

            <div className="wizard-form-grid">
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tên nguồn dữ liệu</label>
                <input
                  type="text" className="form-input" placeholder="vd: raw_user_events"
                  value={sourceStep.new_source_config?.name || ''}
                  onChange={e => onStepChange({ 
                    new_source_config: { ...sourceStep.new_source_config!, name: e.target.value },
                    connectionChecked: false
                  })}
                />
              </div>

              <div>
                <label className="form-label">Định dạng file</label>
                <select
                  className="form-select"
                  value={sourceStep.new_source_config?.source_format || 'PARQUET'}
                  onChange={e => onStepChange({ new_source_config: { ...sourceStep.new_source_config!, source_format: e.target.value as SourceFormat } })}
                >
                  <option value="PARQUET">Parquet</option>
                  <option value="CSV">CSV</option>
                  <option value="JSON">JSON</option>
                </select>
              </div>

              <div>
                <label className="form-label">Location URI</label>
                <input
                  type="text" className="form-input" 
                  placeholder={protocol === 's3' ? 's3://bucket/path' : '/home/data/'}
                  value={sourceStep.new_source_config?.location_uri || ''}
                  onChange={e => onStepChange({ 
                    new_source_config: { ...sourceStep.new_source_config!, location_uri: e.target.value },
                    connectionChecked: false
                  })}
                />
              </div>

              {/* S3 Credentials */}
              {protocol === 's3' && (
                <>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Endpoint URL (MinIO)</label>
                    <input
                      type="text" className="form-input" placeholder="http://localhost:9000"
                      value={sourceStep.new_source_config?.connection_options?.endpoint_url || ''}
                      onChange={e => onStepChange({ 
                        new_source_config: { 
                          ...sourceStep.new_source_config!, 
                          connection_options: { ...sourceStep.new_source_config?.connection_options, endpoint_url: e.target.value } 
                        },
                        connectionChecked: false
                      })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Access Key</label>
                    <input
                      type="password" className="form-input"
                      value={sourceStep.new_source_config?.connection_options?.access_key || ''}
                      onChange={e => onStepChange({ 
                        new_source_config: { 
                          ...sourceStep.new_source_config!, 
                          connection_options: { ...sourceStep.new_source_config?.connection_options, access_key: e.target.value } 
                        },
                        connectionChecked: false
                      })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Secret Key</label>
                    <input
                      type="password" className="form-input"
                      value={sourceStep.new_source_config?.connection_options?.secret_key || ''}
                      onChange={e => onStepChange({ 
                        new_source_config: { 
                          ...sourceStep.new_source_config!, 
                          connection_options: { ...sourceStep.new_source_config?.connection_options, secret_key: e.target.value } 
                        },
                        connectionChecked: false
                      })}
                    />
                  </div>
                </>
              )}

              <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={onCheckSource} 
                  disabled={isCheckingSource}
                  style={{
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center' 
                  }}
                >
                  {isCheckingSource ? <div className="spinner spinner-sm"/> : 'Kiểm tra kết nối'}
                </button>
              </div>

              {sourceStep.connectionChecked && (
                <div style={{ color: '#10b981', fontSize: '13px', gridColumn: '1 / -1', fontWeight: 500, textAlign: 'center' }}>
                  ✓ Kết nối thành công
                </div>
              )}
              {sourceStep.connectionError && (
                <div style={{ color: '#ef4444', fontSize: '13px', gridColumn: '1 / -1', fontWeight: 500, textAlign: 'center' }}>
                  ✗ Lỗi: {sourceStep.connectionError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
