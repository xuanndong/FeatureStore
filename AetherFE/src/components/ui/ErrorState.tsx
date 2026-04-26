import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center', minHeight: '300px',
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)'
    }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
      }}>
        <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Kết nối thất bại
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', marginBottom: '24px', lineHeight: 1.5 }}>
        {message}
      </p>
      <button 
        className="btn btn-primary" 
        onClick={onRetry}
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <RefreshCw size={16} /> Thử lại
      </button>
    </div>
  );
};
