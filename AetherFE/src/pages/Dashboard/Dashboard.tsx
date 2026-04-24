import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Search, RefreshCcw, Eye, Cpu } from 'lucide-react';

interface QuickLinkCardProps {
  title: string;
  desc: string;
  icon: React.ElementType;
  path: string;
  onNavigate: (path: string) => void;
}

const QuickLinkCard = React.memo<QuickLinkCardProps>(({ title, desc, icon: Icon, path, onNavigate }) => (
  <div
    className="card"
    style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--surface)', borderColor: 'transparent',
      padding: '1.5rem',
    }}
  >
    <div style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
      <Icon size={24} />
    </div>
    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h3>
    <p style={{
      color: 'var(--text-secondary)', fontSize: '0.8125rem',
      lineHeight: 1.5, flex: 1, marginBottom: '1.5rem',
    }}>
      {desc}
    </p>
    <button
      className="btn-ghost"
      style={{
        alignSelf: 'flex-start', padding: 0, border: 'none',
        background: 'transparent', color: 'var(--primary)', cursor: 'pointer',
        fontSize: '0.875rem', fontWeight: 500,
      }}
      onClick={() => onNavigate(path)}
    >
      Bắt đầu ngay <span style={{ marginLeft: '0.25rem' }}>→</span>
    </button>
  </div>
));
QuickLinkCard.displayName = 'QuickLinkCard';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const quickLinks = useMemo(() => [
    {
      title: 'Feature Groups',
      desc: 'Tổ chức và quản lý các nhóm đặc trưng dữ liệu từ nhiều nguồn khác nhau.',
      icon: Layers,
      path: '/feature-groups',
    },
    {
      title: 'Online Explorer',
      desc: 'Truy vấn và kiểm tra dữ liệu đặc trưng trong thời gian thực từ Redis.',
      icon: Search,
      path: '/online-explorer',
    },
    {
      title: 'Materialization',
      desc: 'Đồng bộ hóa dữ liệu giữa các kho lưu trữ offline và online.',
      icon: RefreshCcw,
      path: '/materialization',
    },
    {
      title: 'Feature Views',
      desc: 'Đóng gói các đặc trưng để sẵn sàng phục vụ cho mô hình AI.',
      icon: Eye,
      path: '/feature-views',
    },
  ], []);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div style={{ maxWidth: '75rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #3b3ed0 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: 'clamp(1.5rem, 5vw, 3rem) clamp(1.25rem, 4vw, 2.5rem)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Background decoration */}
        <div
          className="hide-on-mobile"
          style={{ position: 'absolute', right: '2.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.15 }}
        >
          <Cpu size={240} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '37.5rem' }}>
          <span style={{
            background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.625rem',
            borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 600,
            display: 'inline-block', marginBottom: '1rem',
          }}>
            v1.0.0
          </span>

          <h1 style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
            fontWeight: 700, marginBottom: '1rem', lineHeight: 1.2,
          }}>
            Chào mừng bạn đến với Aether Platform
          </h1>

          <p style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)', marginTop: '3rem', opacity: 0.9, lineHeight: 1.6 }}>
            Giải pháp MLOps toàn diện để quản lý, biến đổi và phục vụ các đặc trưng dữ liệu (features)
            cho mô hình học máy với hiệu suất tối ưu.
          </p>
        </div>
      </div>

      {/* Quick Links Section */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Truy cập nhanh</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Bắt đầu quy trình làm việc với các công cụ cốt lõi.</p>
          </div>
          <button className="btn btn-primary" style={{ background: '#818cf8' }}>
            Clusters Management
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(15rem, 100%), 1fr))',
          gap: '1.25rem',
        }}>
          {quickLinks.map((item) => (
            <QuickLinkCard
              key={item.title}
              title={item.title}
              desc={item.desc}
              icon={item.icon}
              path={item.path}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </div>

    </div>
  );
};
