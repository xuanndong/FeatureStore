import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { EntityOption, WizardEntityStep } from '@/types';

interface Step1EntityProps {
  entityOptions: EntityOption[];
  entityStep: WizardEntityStep;
  entityExpand: 'choose' | 'create' | null;
  onExpandChange: (mode: 'choose' | 'create') => void;
  onStepChange: (step: WizardEntityStep) => void;
}

export const Step1Entity: React.FC<Step1EntityProps> = React.memo(({
  entityOptions, 
  entityStep, 
  entityExpand, 
  onExpandChange, 
  onStepChange,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div
        style={{ 
          padding: '16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          cursor: 'pointer', 
          background: entityExpand === 'choose' ? 'var(--surface-hover)' : 'transparent' 
        }}
        onClick={() => { 
          onExpandChange('choose'); 
          onStepChange({ 
            entity_id: entityStep.entity_id, 
            new_entity_config: undefined 
          }); 
        }}
      >
        <span style={{ fontWeight: 600 }}>Chọn thực thể</span>
        {entityExpand === 'choose' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      
      {entityExpand === 'choose' && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <select
            className="form-select"
            value={entityStep.entity_id || ''} 
            onChange={e => onStepChange({ entity_id: e.target.value })}
          >
            <option value="">Chọn một thực thể...</option>
            {entityOptions.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <p className="form-hint">
            Thực thể xác định cách dữ liệu sẽ được liên kết và truy vấn trong Online Store.
          </p>
        </div>
      )}
    </div>

    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div
        style={{ 
          padding: '16px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          cursor: 'pointer', 
          background: entityExpand === 'create' ? 'var(--surface-hover)' : 'transparent' 
        }}
        onClick={() => { 
          onExpandChange('create'); 
          onStepChange({ 
            entity_id: undefined, 
            new_entity_config: entityStep.new_entity_config || { name: '', join_key: '', description: '' } 
          }); 
        }}
      >
        <span style={{ fontWeight: 600 }}>Tạo thực thể</span>
        {entityExpand === 'create' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      
      {entityExpand === 'create' && (
        <div className="wizard-form-grid" style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div>
            <label className="form-label">Tên thực thể</label>
            <input
              type="text" 
              className="form-input" 
              placeholder="Ví dụ: customer, device_log"
              value={entityStep.new_entity_config?.name || ''}
              onChange={e => onStepChange({ 
                new_entity_config: { ...entityStep.new_entity_config!, name: e.target.value } 
              })}
            />
            <p className="form-hint">Chỉ sử dụng chữ thường, số và dấu gạch dưới.</p>
          </div>
          
          <div>
            <label className="form-label">Khóa liên kết</label>
            <input
              type="text" 
              className="form-input" 
              placeholder="Ví dụ: user_id"
              value={entityStep.new_entity_config?.join_key || ''}
              onChange={e => onStepChange({ 
                new_entity_config: { ...entityStep.new_entity_config!, join_key: e.target.value } 
              })}
            />
            <p className="form-hint">Khóa chính được sử dụng để ghép nối.</p>
          </div>
          
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Mô tả chi tiết</label>
            <textarea
              className="form-textarea" 
              placeholder="Mô tả mục đích..."
              value={entityStep.new_entity_config?.description || ''}
              onChange={e => onStepChange({ 
                new_entity_config: { ...entityStep.new_entity_config!, description: e.target.value } 
              })}
            />
          </div>
        </div>
      )}
    </div>

  </div>
));

Step1Entity.displayName = 'Step1Entity';
