import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroBanner } from '@/pages/Dashboard/HeroBanner';
import { QuickLinksSection } from '@/pages/Dashboard/QuickLinksSection';
import { QUICK_LINKS_DATA } from '@/pages/Dashboard/constants';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div
      style={{
        maxWidth: '75rem',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
      }}
    >
      <HeroBanner />
      <QuickLinksSection items={QUICK_LINKS_DATA} onNavigate={handleNavigate} />
    </div>
  );
};

export default Dashboard;
