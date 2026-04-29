import React, { useState } from 'react';
import { FeatureViewList } from '@/pages/FeatureViews/FeatureViewList';
import { FeatureViewBuilder } from '@/pages/FeatureViews/FeatureViewBuilder';
import { FeatureViewDetail } from '@/pages/FeatureViews/FeatureViewDetail';

export const FeatureViewsPage: React.FC = () => {
  const [mode, setMode] = useState<'list' | 'create' | 'detail'>('list');
  
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);

  const handleOpenDetail = (id: string) => {
    setSelectedViewId(id);
    setMode('detail');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {mode === 'list' && (
        <FeatureViewList 
          onCreateNew={() => setMode('create')} 
          onViewDetail={handleOpenDetail}
        />
      )}

      {mode === 'create' && (
        <FeatureViewBuilder 
          onBack={() => setMode('list')} 
        />
      )}

      {mode === 'detail' && selectedViewId && (
        <FeatureViewDetail 
          viewId={selectedViewId} 
          onBack={() => setMode('list')} 
        />
      )}

    </div>
  );
};
