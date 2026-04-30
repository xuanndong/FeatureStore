import React, { useState } from 'react';
import { RefreshCcw, HardDrive, Zap } from 'lucide-react';
import { FeatureMarketPage } from '@/components/ui/FeatureMarketPage';
import { OnlineStorePage } from '@/components/ui/OnlineStorePage';

export const MaterializationPage: React.FC = () => {
  const [activeStore, setActiveStore] = useState<'OFFLINE' | 'ONLINE' | null>(null);

  // Render Offline Store
  if (activeStore === 'OFFLINE') {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <button onClick={() => setActiveStore(null)} style={{ marginBottom: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, padding: 0 }}>
          ← Chọn Store khác
        </button>
        <FeatureMarketPage />
      </div>
    );
  }

  // Render Online Store
  if (activeStore === 'ONLINE') {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <button onClick={() => setActiveStore(null)} style={{ marginBottom: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, padding: 0 }}>
          ← Chọn Store khác
        </button>
        <OnlineStorePage />
      </div>
    );
  }

  // Render Main Menu
  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
      <div style={{ width: '80px', height: '80px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCcw size={40} />
      </div>
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>Materialization Center</h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
          Trung tâm quản lý các tiến trình đồng bộ dữ liệu. Chọn không gian lưu trữ để tiếp tục.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%', marginTop: '20px' }}>
        
        <div className="card" onClick={() => setActiveStore('OFFLINE')} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-color)', padding: '24px', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <HardDrive size={24} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Offline Store</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Khám phá Feature Market, tải dữ liệu (S3) và thực thi mã huấn luyện (Ray).</p>
        </div>

        <div className="card" onClick={() => setActiveStore('ONLINE')} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-color)', padding: '24px', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <Zap size={24} color="#f59e0b" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Online Store</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Giám sát luồng streaming và tra cứu đặc trưng thời gian thực (Redis).</p>
        </div>

      </div>
    </div>
  );
};
