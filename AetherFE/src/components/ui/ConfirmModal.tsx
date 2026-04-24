import React from 'react';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onCancel}><X size={20} /></button>
        </div>
        <div style={{ marginBottom: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={onCancel}>{cancelText}</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};
