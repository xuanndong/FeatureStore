import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PreviewModalProps {
  previewResult: any;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ previewResult, onClose }) => {
  const [activeTab, setActiveTab] = useState<'TABLE' | 'CHART' | 'JSON'>('TABLE');
  const [selectedMetric, setSelectedMetric] = useState<string>('');

  const { datasetName, rows, numericColumns, allColumns } = useMemo(() => {
    if (!previewResult?.preview_data) return { datasetName: '', rows: [], numericColumns: [], allColumns: [] };
    
    const dsName = Object.keys(previewResult.preview_data)[0];
    const data = previewResult.preview_data[dsName] || [];
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    
    const numCols = cols.filter(key => typeof data[0][key] === 'number');

    return { datasetName: dsName, rows: data, numericColumns: numCols, allColumns: cols };
  }, [previewResult]);

  React.useEffect(() => {
    if (numericColumns.length > 0 && !selectedMetric) {
      setSelectedMetric(numericColumns.includes('score') ? 'score' : numericColumns[0]);
    }
  }, [numericColumns, selectedMetric]);

  if (!previewResult) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose} 
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(241, 245, 249, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
    >
      <div 
        className="modal-box" 
        style={{ width: '950px', maxWidth: '95vw', height: '75vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }} 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: 600 }}>
            Kết quả Preview: <span style={{color: '#a855f7'}}>{datasetName}</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 16px', backgroundColor: '#f1f5f9' }}>
          {['TABLE', 'CHART', 'JSON'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                background: 'none', border: 'none', padding: '12px 20px', cursor: 'pointer', fontWeight: 500, fontSize: '14px', letterSpacing: '0.3px',
                color: activeTab === tab ? '#a855f7' : '#64748b',
                borderBottom: activeTab === tab ? '2px solid #a855f7' : '2px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              {tab === 'TABLE' ? 'Bảng dữ liệu' : tab === 'CHART' ? 'Biểu đồ phân tích' : 'Raw JSON'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '20px', display: 'flex', flexDirection: 'column', backgroundColor: '#f1f5f9' }}>
          
          {/* Table */}
          {activeTab === 'TABLE' && (
            <div style={{ flex: 1, overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#1e293b', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#e2e8f0', zIndex: 1 }}>
                  <tr>
                    {allColumns.map(col => (
                      <th key={col} style={{ padding: '14px 16px', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, i: number) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : '#f1f5f9', transition: 'background-color 0.15s ease' }} className="hover:bg-slate-200">
                      {allColumns.map(col => (
                        <td key={col} style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                          {typeof row[col] === 'number' ? Number(row[col]).toFixed(4).replace(/\.0000$/, '') : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Chart */}
          {activeTab === 'CHART' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: '14px', fontWeight: 500 }}>Chọn đặc trưng (Trục Y):</span>
                <select 
                  value={selectedMetric} 
                  onChange={e => setSelectedMetric(e.target.value)}
                  style={{ padding: '8px 12px', backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                >
                  {numericColumns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey={allColumns[0]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{stroke: '#cbd5e1'}} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={{stroke: '#cbd5e1'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#1e293b', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                      cursor={{ fill: '#e2e8f0', opacity: 0.4 }}
                    />
                    <Bar dataKey={selectedMetric} fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Json */}
          {activeTab === 'JSON' && (
            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <pre style={{ margin: 0, color: '#166534', fontFamily: "'Fira Code', monospace", fontSize: '13px', lineHeight: '1.5' }}>
                {JSON.stringify(previewResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
