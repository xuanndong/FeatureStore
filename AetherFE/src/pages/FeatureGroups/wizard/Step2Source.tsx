import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DataSourceOption, WizardSourceStep, SourceFormat } from '@/types';

interface Step2SourceProps {
  sourceOptions: DataSourceOption[];
  sourceStep: WizardSourceStep & { connectionError?: string | null }; // Thêm type linh hoạt cho error
  sourceExpand: 'choose' | 'create' | null;
  isCheckingSource: boolean;
  onExpandChange: (mode: 'choose' | 'create') => void;
  onStepChange: (step: WizardSourceStep & { connectionError?: string | null }) => void;
  onCheckSource: () => void;
}

export const Step2Source: React.FC<Step2SourceProps> = React.memo(({
  sourceOptions, sourceStep, sourceExpand, isCheckingSource,
  onExpandChange, onStepChange, onCheckSource,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

    {/* Choose Existing Source */}
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div
        style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: sourceExpand === 'choose' ? 'var(--surface-hover)' : 'transparent' }}
        onClick={() => { 
          onExpandChange('choose'); 
          onStepChange({ 
            source_id: sourceStep.source_id,
            new_source_config: undefined,
            connectionChecked: false,
            connectionError: null
          }); 
        }}
      >
        <span style={{ fontWeight: 600 }}>Chọn nguồn dữ liệu</span>
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

    {/* Create New Source */}
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div
        style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', background: sourceExpand === 'create' ? 'var(--surface-hover)' : 'transparent' }}
        onClick={() => { 
          onExpandChange('create'); 
          onStepChange({ 
            source_id: undefined,
            new_source_config: sourceStep.new_source_config || { name: '', source_type: 'BATCH', source_format: 'PARQUET', location_uri: '' },
            connectionChecked: sourceStep.connectionChecked || false,
            connectionError: null
          }); 
        }}
      >
        <span style={{ fontWeight: 600 }}>Tạo nguồn dữ liệu</span>
        {sourceExpand === 'create' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      {sourceExpand === 'create' && (
        <div className="wizard-form-grid" style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div>
            <label className="form-label">Loại nguồn</label>
            <select disabled className="form-select"><option>BATCH</option></select>
          </div>
          <div>
            <label className="form-label">Định dạng</label>
            <select
              className="form-select"
              value={sourceStep.new_source_config?.source_format || 'PARQUET'}
              onChange={e => onStepChange({ new_source_config: { ...sourceStep.new_source_config!, source_format: e.target.value as SourceFormat } })}
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
              onChange={e => onStepChange({ 
                new_source_config: { ...sourceStep.new_source_config!, name: e.target.value }, 
                connectionChecked: false, 
                connectionError: null 
              })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Vị trí kết nối (Location URI)</label>
              <input
                type="text" className="form-input" placeholder="s3://bucket-name/path/to/data/"
                value={sourceStep.new_source_config?.location_uri || ''}
                onChange={e => onStepChange({ 
                  new_source_config: { ...sourceStep.new_source_config!, location_uri: e.target.value }, 
                  connectionChecked: false,
                  connectionError: null
                })}
              />
            </div>
            <button className="btn btn-secondary" onClick={onCheckSource} disabled={isCheckingSource}>
              {isCheckingSource ? <div className="spinner spinner-sm" /> : 'Kiểm tra'}
            </button>
          </div>
          
          {sourceStep.connectionChecked && (
            <div style={{ color: '#10b981', fontSize: '13px', gridColumn: '1 / -1', fontWeight: 500 }}>
              ✓ Kết nối thành công
            </div>
          )}
          {sourceStep.connectionError && (
            <div style={{ color: '#ef4444', fontSize: '13px', gridColumn: '1 / -1', fontWeight: 500 }}>
              ✗ Kết nối thất bại: {sourceStep.connectionError}
            </div>
          )}
        </div>
      )}
    </div>

  </div>
));

Step2Source.displayName = 'Step2Source';