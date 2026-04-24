import React from 'react';
import { RefreshCcw, HardDrive, Zap } from 'lucide-react';

export const MaterializationPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
      
      <div style={{ width: '80px', height: '80px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCcw size={40} />
      </div>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>Materialization Center</h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
          Trung tâm quản lý các tiến trình đồng bộ dữ liệu (Materialization Jobs).
          Phân hệ này đang được phát triển và sẽ sớm ra mắt trong bản cập nhật tiếp theo.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%', marginTop: '20px' }}>
        <div className="card" style={{ textAlign: 'left' }}>
          <HardDrive size={24} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Offline Store</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Lưu trữ dữ liệu batch cho huấn luyện mô hình (S3, GCS).</p>
        </div>
        <div className="card" style={{ textAlign: 'left' }}>
          <Zap size={24} color="#f59e0b" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Online Store</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Phục vụ dữ liệu độ trễ thấp theo thời gian thực (Redis).</p>
        </div>
      </div>

    </div>
  );
};
