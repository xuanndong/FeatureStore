import React, { useMemo, useEffect } from 'react';
import { Key, AlertCircle, Info, Lightbulb, Database, Plus } from 'lucide-react';
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
}) => {
  const activeTab = entityExpand === 'create' ? 'create' : 'choose';

  useEffect(() => {
    if (!entityExpand) {
      onExpandChange('choose');
    }
  }, [entityExpand, onExpandChange]);

  const selectedEntity = useMemo(() => {
    return entityOptions.find(e => e.id === entityStep.entity_id);
  }, [entityOptions, entityStep.entity_id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}> {/* Giảm gap tổng thể từ 24px xuống 16px */}

      {/* --- BANNER --- */}
      <div style={{ 
        padding: '10px 14px',
        backgroundColor: 'rgba(2, 132, 199, 0.05)', 
        border: '1px solid var(--primary)', 
        borderRadius: 'var(--radius-sm)', 
        display: 'flex', 
        gap: '10px', 
        alignItems: 'flex-start' 
      }}>
        <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-primary)', marginRight: '4px' }}>
            Hợp đồng định danh:
          </strong>
          Khóa liên kết (Join Key) của Thực thể là bắt buộc để hệ thống tự động ghép nối các loại dữ liệu (Bảng, Ảnh, Audio).
        </div>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border)', 
          gap: '20px'
        }}>
          {/* TAB 1 */}
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'choose' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'choose' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'choose' ? 600 : 500,
              fontSize: '14.5px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => { 
              onExpandChange('choose'); 
              onStepChange({ entity_id: entityStep.entity_id, new_entity_config: undefined }); 
            }}
          >
            <Database size={16} /> Chọn thực thể đã có
          </button>

          {/* TAB 2 */}
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'create' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'create' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'create' ? 600 : 500,
              fontSize: '14.5px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => { 
              onExpandChange('create'); 
              onStepChange({ 
                entity_id: undefined, 
                new_entity_config: entityStep.new_entity_config || { name: '', join_key: '', description: '' } 
              }); 
            }}
          >
            <Plus size={16} /> Tạo thực thể mới
          </button>
        </div>

        {/* --- TAB CONTENT --- */}
        <div style={{ paddingTop: '16px' }}>
          
          {/* CHOOSE ENTITY */}
          {activeTab === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
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
              </div>

              {/* WARNING DATA */}
              <div style={{ 
                padding: '10px 12px', 
                backgroundColor: 'var(--surface-hover)', 
                borderLeft: '3px solid #eab308',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', 
                display: 'flex', 
                gap: '8px', 
                alignItems: 'flex-start' 
              }}>
                <Lightbulb size={16} style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Nếu dữ liệu là <strong>độc lập</strong>, hãy chuyển sang thẻ <strong>Tạo thực thể mới</strong> để tránh nhiễu dữ liệu.
                </span>
              </div>

              {/* JOIN KEY */}
              {selectedEntity && (
                <div style={{ 
                  padding: '12px 16px', 
                  backgroundColor: 'rgba(2, 132, 199, 0.05)',
                  border: '1px dashed var(--primary)', 
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Key size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Dữ liệu của bạn phải chứa định danh:</div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'monospace' }}>{selectedEntity.join_key}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CREATE ENTITY */}
          {activeTab === 'create' && (
            <div className="wizard-form-grid" style={{ gap: '16px' }}>
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
              </div>
              
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'rgba(239, 68, 68, 0.03)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', 
                borderRadius: 'var(--radius-sm)'
              }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} style={{ color: 'rgb(239, 68, 68)' }} /> Khóa liên kết (Join Key) <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text" 
                  className="form-input" 
                  placeholder="Ví dụ: user_id, session_id"
                  value={entityStep.new_entity_config?.join_key || ''}
                  onChange={e => onStepChange({ 
                    new_entity_config: { ...entityStep.new_entity_config!, join_key: e.target.value } 
                  })}
                />
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', color: 'rgb(239, 68, 68)', fontSize: '12.5px', lineHeight: '1.4' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Dữ liệu (bảng, ảnh, text) phải có chung khóa này để ghép nối.</span>
                </div>
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Mô tả chi tiết</label>
                <textarea
                  className="form-textarea" 
                  placeholder="Mô tả mục đích của thực thể này..."
                  style={{ minHeight: '80px' }}
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

    </div>
  );
});

Step1Entity.displayName = 'Step1Entity';
