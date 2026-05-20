import React from 'react';
import { Info } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import type { ScheduleInterval } from '@/types';

interface FinishModalProps {
  isOpen: boolean;
  fgName: string;
  useOnlineStore: boolean;
  isScheduled: boolean;
  cronExp: ScheduleInterval;
  isSubmitting: boolean;
  onClose: () => void;
  onFinish: () => void;
  onFgNameChange: (val: string) => void;
  onUseOnlineStoreChange: (val: boolean) => void;
  onScheduledChange: (val: boolean) => void;
  onCronExpChange: (val: ScheduleInterval) => void;
}

export const FinishModal: React.FC<FinishModalProps> = React.memo(({
  isOpen, fgName, useOnlineStore, isScheduled, cronExp, isSubmitting,
  onClose, onFinish, onFgNameChange, onUseOnlineStoreChange, onScheduledChange, onCronExpChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Feature Group</h3>
          <button className="modal-close" onClick={onClose}>
            <span style={{ fontSize: '20px' }}>×</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
          <div>
            <label className="form-label">Tên Feature Group <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text" className="form-input" placeholder="Nhập tên feature group..."
              value={fgName} onChange={e => onFgNameChange(e.target.value)}
            />
          </div>

          {/* Online Store Configuration */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Online Store (Redis)</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Bật để đồng bộ kết quả tính toán mới nhất lên Redis phục vụ truy vấn độ trễ thấp
              </div>
            </div>
            <Toggle checked={useOnlineStore} onChange={onUseOnlineStoreChange} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />

          {/* Schedule Configuration */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Tự động lập lịch (Schedule)</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Bật để tự động cập nhật dữ liệu định kỳ
              </div>
            </div>
            <Toggle checked={isScheduled} onChange={onScheduledChange} />
          </div>

          {isScheduled && (
            <div>
              <label className="form-label">Cron Expression</label>
              <select className="form-select" value={cronExp} onChange={e => onCronExpChange(e.target.value as ScheduleInterval)}>
                <option value="HOURLY">HOURLY</option>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="QUARTERLY">QUARTERLY</option>
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
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={onFinish} disabled={isSubmitting}>
            {isSubmitting ? <div className="spinner spinner-sm" /> : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
});

FinishModal.displayName = 'FinishModal';
