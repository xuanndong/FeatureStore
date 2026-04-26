import React from 'react';
import { Database, FolderTree, Code2, Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { num: 1 as const, icon: Database, label: 'THỰC THỂ' },
  { num: 2 as const, icon: FolderTree, label: 'NGUỒN DỮ LIỆU' },
  { num: 3 as const, icon: Code2, label: 'LOGIC BIẾN ĐỔI' },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
    {STEPS.map((s, i) => (
      <React.Fragment key={s.num}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '8px', opacity: currentStep >= s.num ? 1 : 0.4
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: currentStep === s.num ? '#1a1f36' : currentStep > s.num ? 'var(--primary)' : 'var(--surface)',
            color: currentStep === s.num ? 'white' : currentStep > s.num ? 'white' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s ease',
          }}>
            {currentStep > s.num ? <Check size={20} /> : <s.icon size={20} />}
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>
            {s.label}
          </span>
        </div>
        {i < 2 && (
          <div style={{
            flex: 1, height: '1px', background: 'var(--border)',
            maxWidth: '100px', opacity: currentStep > s.num ? 1 : 0.4,
            transition: 'opacity 0.2s ease',
          }} />
        )}
      </React.Fragment>
    ))}
  </div>
);
