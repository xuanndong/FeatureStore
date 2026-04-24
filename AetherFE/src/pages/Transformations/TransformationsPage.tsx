import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Search, Play, Save, ChevronRight, FileCode, Layers, Database } from 'lucide-react';
import type { TransformationType } from '@/types';

// Mock data since there's no specific transformation list API in photon router yet
const MOCK_TRANSFORMATIONS = [
  { id: '1', name: 'user_daily_activity_agg', type: 'AGGREGATION' as TransformationType, updated_at: '2 giờ trước' },
  { id: '2', name: 'clean_payment_logs', type: 'SQL' as TransformationType, updated_at: '5 giờ trước' },
  { id: '3', name: 'risk_score_calculator', type: 'PYTHON_UDF' as TransformationType, updated_at: 'Hôm qua' },
  { id: '4', name: 'merchant_revenue_summary', type: 'SQL' as TransformationType, updated_at: '2 ngày trước' },
  { id: '5', name: 'session_duration_calc', type: 'AGGREGATION' as TransformationType, updated_at: '1 tuần trước' },
];

export const TransformationsPage: React.FC = () => {
  const [activeTransform, setActiveTransform] = useState(MOCK_TRANSFORMATIONS[0]);
  const [code, setCode] = useState('-- SQL Transformation for user_daily_activity_agg\nSELECT\n  user_id,\n  COUNT(action_id) as total_actions,\n  SUM(amount) as total_spend,\n  CURRENT_TIMESTAMP() as processed_at\nFROM raw_events\nWHERE status = \'SUCCESS\'\nGROUP BY user_id;');
  const [outputConsole] = useState('[INFO] Successfully connected to metadata registry.\n[INFO] Loaded transformation template for SQL mode.\n[INFO] Validating schema for entity \'user\'...\n[READY] Transformation Studio active. Waiting for input.');

  const getIconForType = (type: TransformationType) => {
    if (type === 'SQL') return <Database size={16} color="#3b82f6" />;
    if (type === 'PYTHON_UDF') return <FileCode size={16} color="#f59e0b" />;
    return <Layers size={16} color="#8b5cf6" />;
  };

  const getLanguage = (type: TransformationType) => {
    return type === 'PYTHON_UDF' ? 'python' : 'sql';
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--topbar-height) - 48px)', gap: '20px', margin: '-24px', padding: '24px', background: 'var(--bg-secondary)' }}>

      {/* Left Sidebar - Logic Library */}
      <div className="card" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: 0, flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>LOGIC LIBRARY</h2>
          <button className="btn-ghost" style={{ padding: '4px', borderRadius: '4px' }}>+</button>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search transformations..."
              className="form-input"
              style={{ paddingLeft: '32px', height: '32px', fontSize: '12px', borderRadius: '16px', background: 'var(--bg-secondary)', border: 'none' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {MOCK_TRANSFORMATIONS.map(item => (
            <div
              key={item.id}
              style={{
                padding: '16px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                background: activeTransform.id === item.id ? 'var(--primary-light)' : 'transparent',
                borderLeft: `3px solid ${activeTransform.id === item.id ? 'var(--primary)' : 'transparent'}`
              }}
              onClick={() => setActiveTransform(item)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {getIconForType(item.type)}
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge" style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                  {item.type}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.updated_at}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Editor Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

        {/* Editor Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <FileCode size={18} /> {activeTransform.name}
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>TYPE:</span>
              <select className="form-select" style={{ height: '32px', padding: '4px 30px 4px 12px', width: 'auto' }} value={activeTransform.type} disabled>
                <option value="SQL">SQL</option>
                <option value="PYTHON_UDF">PYTHON_UDF</option>
                <option value="AGGREGATION">AGGREGATION</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary">
              <Play size={16} /> Run Script
            </button>
            <button className="btn" style={{ background: '#1a1f36', color: 'white' }}>
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>

        {/* Editor Container */}
        <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', gap: '16px', letterSpacing: '0.05em' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ChevronRight size={14} /> MAIN.PY
            </div>
            <div>|</div>
            <div>UTF-8</div>
            <div>|</div>
            <div>INDENT: 4 SPACES</div>
          </div>
          <div style={{ flex: 1 }}>
            <Editor
              height="100%"
              language={getLanguage(activeTransform.type)}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 16 } }}
            />
          </div>
        </div>

        {/* Output Console */}
        <div className="card" style={{ height: '200px', padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>OUTPUT CONSOLE</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }}></div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto', background: 'var(--bg)', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6 }}>
            {outputConsole.split('\n').map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('[INFO]') ? '#10b981' : line.startsWith('[READY]') ? '#3b82f6' : 'var(--text-primary)'
              }}>
                {line}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
