import React from 'react';
import { Cpu } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #3b3ed0 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1.25rem, 4vw, 2.5rem)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1rem'
      }}
    >
      {/* Background decoration */}
      <div
        className="hide-on-mobile"
        style={{
          position: 'absolute',
          right: '2.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          opacity: 0.15,
        }}
      >
        <Cpu size={240} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '37.5rem' }}>
        <span
          style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '0.25rem 0.625rem',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            display: 'inline-block',
            marginBottom: '1rem',
          }}
        >
          v1.0.0
        </span>

        <h1
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
            fontWeight: 700,
            marginBottom: '1rem',
            lineHeight: 1.2,
          }}
        >
          Chào mừng bạn đến với Aether Platform
        </h1>

        <p
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.06rem)',
            marginTop: '1rem',
            opacity: 0.9,
            lineHeight: 1.6,
          }}
        >
          Giải pháp MLOps toàn diện để quản lý, biến đổi và phục vụ các đặc trưng dữ liệu (features)
          cho mô hình học máy với hiệu suất tối ưu.
        </p>
      </div>
    </div>
  );
};
