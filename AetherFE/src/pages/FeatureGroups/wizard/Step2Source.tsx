import React, { useState, useEffect } from 'react';
import { Database, Plus, HardDrive, Cloud, Info, FolderTree, FileCode2, Table } from 'lucide-react';
import type { DataSourceOption, WizardSourceStep, SourceFormat } from '@/types';

interface Step2SourceProps {
  sourceOptions: DataSourceOption[];
  sourceStep: WizardSourceStep & { connectionError?: string | null };
  sourceExpand: 'choose' | 'create' | null;
  isCheckingSource: boolean;
  onExpandChange: (mode: 'choose' | 'create') => void;
  onStepChange: (step: any) => void;
  onCheckSource: () => void;
}

export const Step2Source: React.FC<Step2SourceProps> = React.memo(({
  sourceOptions, sourceStep, sourceExpand, isCheckingSource,
  onExpandChange, onStepChange, onCheckSource,
}) => {
  const activeTab = sourceExpand === 'create' ? 'create' : 'choose';

  const [protocol, setProtocol] = useState<'local' | 's3'>(
    sourceStep.new_source_config?.location_uri?.startsWith('s3://') ? 's3' : 'local'
  );

  useEffect(() => {
    if (!sourceExpand) {
      onExpandChange('choose');
    }
  }, [sourceExpand, onExpandChange]);

  const handleProtocolChange = (type: 'local' | 's3') => {
    setProtocol(type);
    const prefix = type === 's3' ? 's3://' : '/';
    onStepChange({
      ...sourceStep,
      new_source_config: { 
        ...sourceStep.new_source_config!, 
        location_uri: prefix,
        connection_options: type === 'local' ? undefined : sourceStep.new_source_config?.connection_options 
      },
      connectionChecked: false,
      connectionError: null
    });
  };

  const currentFormat = sourceStep.new_source_config?.source_format || 'PARQUET';
  // Xác định loại dữ liệu để hiển thị UI tương ứng
  const isUnstructured = ['IMAGE', 'AUDIO', 'VIDEO', 'TEXT', 'BINARY'].includes(currentFormat);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* --- PHẦN TABS NAVIGATION --- */}
      <div>
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border)', 
          gap: '20px' 
        }}>
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: activeTab === 'choose' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'choose' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'choose' ? 600 : 500,
              fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s ease',
            }}
            onClick={() => onExpandChange('choose')}
          >
            <Database size={16} /> Chọn nguồn đã đăng ký
          </button>

          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: activeTab === 'create' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'create' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'create' ? 600 : 500,
              fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s ease',
            }}
            onClick={() => onExpandChange('create')}
          >
            <Plus size={16} /> Đăng ký nguồn mới
          </button>
        </div>

        {/* --- NỘI DUNG TABS --- */}
        <div style={{ paddingTop: '20px' }}>
          
          {/* TAB: CHỌN NGUỒN ĐÃ CÓ */}
          {activeTab === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Danh sách nguồn dữ liệu</label>
                <select
                  className="form-select"
                  value={sourceStep.source_id || ''}
                  onChange={e => onStepChange({ source_id: e.target.value })}
                >
                  <option value="">Chọn một nguồn dữ liệu đã kết nối...</option>
                  {sourceOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* TAB: TẠO NGUỒN MỚI */}
          {activeTab === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Nút chọn giao thức lưu trữ */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className={`btn ${protocol === 'local' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ flex: 1, gap: '8px', padding: '10px' }}
                  onClick={() => handleProtocolChange('local')}
                >
                  <HardDrive size={18} /> Local File System
                </button>
                <button 
                  className={`btn ${protocol === 's3' ? 'btn-primary' : 'btn-ghost'}`} 
                  style={{ flex: 1, gap: '8px', padding: '10px' }}
                  onClick={() => handleProtocolChange('s3')}
                >
                  <Cloud size={18} /> S3 / MinIO
                </button>
              </div>

              <div className="wizard-form-grid" style={{ rowGap: '16px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Tên nguồn dữ liệu</label>
                  <input
                    type="text" className="form-input" placeholder="vd: raw_data_source"
                    value={sourceStep.new_source_config?.name || ''}
                    onChange={e => onStepChange({ 
                      new_source_config: { ...sourceStep.new_source_config!, name: e.target.value },
                      connectionChecked: false
                    })}
                  />
                </div>

                <div>
                  <label className="form-label">Định dạng file</label>
                  <select
                    className="form-select"
                    value={currentFormat}
                    onChange={e => onStepChange({ new_source_config: { ...sourceStep.new_source_config!, source_format: e.target.value as SourceFormat } })}
                  >
                    <optgroup label="Dữ liệu Bảng (Structured)">
                      <option value="PARQUET">Parquet</option>
                      <option value="CSV">CSV</option>
                      <option value="JSON">JSON</option>
                    </optgroup>
                    <optgroup label="Dữ liệu Phi cấu trúc (Unstructured)">
                      <option value="IMAGE">Image (Ảnh)</option>
                      <option value="AUDIO">Audio (Âm thanh)</option>
                      <option value="VIDEO">Video</option>
                      <option value="TEXT">Text (Văn bản)</option>
                      <option value="BINARY">Binary (Tệp nhị phân)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="form-label">Location URI</label>
                  <input
                    type="text" className="form-input" 
                    placeholder={protocol === 's3' ? 's3://bucket/path/to/data/' : '/home/data/'}
                    value={sourceStep.new_source_config?.location_uri || ''}
                    onChange={e => onStepChange({ 
                      new_source_config: { ...sourceStep.new_source_config!, location_uri: e.target.value },
                      connectionChecked: false
                    })}
                  />
                </div>

                {/* ========================================================= */}
                {/* DYNAMIC DOCUMENTATION BLOCK (IDENTITY MAPPING REQUIREMENTS) */}
                {/* ========================================================= */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ 
                    padding: '16px', 
                    backgroundColor: 'var(--surface-hover)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h4 style={{ margin: '0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Info size={16} style={{ color: 'var(--primary)' }} /> Yêu cầu về Dữ liệu đầu vào (Identity Mapping)
                    </h4>
                    
                    {!isUnstructured ? (
                      /* HƯỚNG DẪN DỮ LIỆU BẢNG */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--background)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Table size={16} /> Dữ liệu có cấu trúc (Structured Data)
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <li><strong>Tốt nhất:</strong> Dữ liệu thô nên có sẵn một cột chứa giá trị Join Key. Nếu cột trùng tên với Join Key của Entity, hệ thống sẽ tự nhận diện.</li>
                            <li><strong>Xử lý ngoại lệ:</strong> Nếu cột có tên khác (ví dụ: thô là <code>customer_no</code>, Entity yêu cầu <code>customer_id</code>), người dùng phải sử dụng <strong>SQL (AS)</strong> hoặc <strong>Python UDF</strong> ở bước sau để đổi tên cột về đúng Join Key.</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      /* HƯỚNG DẪN DỮ LIỆU PHI CẤU TRÚC */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0' }}>
                          Do không có cột, định danh sẽ được trích xuất từ <strong>Không gian lưu trữ (Storage Metadata)</strong>.
                        </p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          
                          {/* Thẻ Hive */}
                          <div style={{ flex: 1, minWidth: '250px', padding: '14px', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(2, 132, 199, 0.05)' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FolderTree size={16} /> Cách 1: Quy ước Thư mục (Khuyên dùng)
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                              Tổ chức thư mục trên {protocol === 's3' ? 'S3/MinIO' : 'Local'} theo định dạng <code>key=value</code>.<br/>
                              <div style={{ margin: '8px 0', padding: '8px', background: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                <strong>Cấu trúc:</strong> <code style={{ color: 'var(--text-primary)' }}>{protocol === 's3' ? 's3://bucket/path/' : '/home/data/'}<span style={{ color: 'var(--primary)' }}>product_id=P001</span>/image_01.jpg</code>
                              </div>
                              <strong>Kết quả:</strong> Hệ thống tự động tạo cột <code>product_id</code> với giá trị <code>P001</code>.
                            </div>
                          </div>

                          {/* Thẻ Regex/Path */}
                          <div style={{ flex: 1, minWidth: '250px', padding: '14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--background)' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileCode2 size={16} /> Cách 2: Trích xuất từ Đường dẫn
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                              Nếu không thể chia thư mục, định danh phải xuất hiện trong tên tệp hoặc đường dẫn.<br/>
                              <div style={{ margin: '8px 0', padding: '8px', background: 'var(--surface-hover)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                <strong>Ví dụ:</strong> <code style={{ color: 'var(--text-primary)' }}>{protocol === 's3' ? 's3://bucket/audio/' : '/home/data/audio/'}<span style={{ color: '#eab308' }}>USER123</span>_call_record.mp3</code>
                              </div>
                              <strong>Xử lý:</strong> Người dùng sử dụng biểu thức chính quy (Regex) hoặc logic trong UDF để bóc tách chuỗi <code>USER123</code>.
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* ========================================================= */}

                {/* S3 Credentials */}
                {protocol === 's3' && (
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Endpoint URL (Dành cho MinIO)</label>
                      <input
                        type="text" className="form-input" placeholder="http://localhost:9000"
                        value={sourceStep.new_source_config?.connection_options?.endpoint_url || ''}
                        onChange={e => onStepChange({ 
                          new_source_config: { 
                            ...sourceStep.new_source_config!, 
                            connection_options: { ...sourceStep.new_source_config?.connection_options, endpoint_url: e.target.value } 
                          },
                          connectionChecked: false
                        })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Access Key</label>
                      <input
                        type="password" className="form-input"
                        value={sourceStep.new_source_config?.connection_options?.access_key || ''}
                        onChange={e => onStepChange({ 
                          new_source_config: { 
                            ...sourceStep.new_source_config!, 
                            connection_options: { ...sourceStep.new_source_config?.connection_options, access_key: e.target.value } 
                          },
                          connectionChecked: false
                        })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Secret Key</label>
                      <input
                        type="password" className="form-input"
                        value={sourceStep.new_source_config?.connection_options?.secret_key || ''}
                        onChange={e => onStepChange({ 
                          new_source_config: { 
                            ...sourceStep.new_source_config!, 
                            connection_options: { ...sourceStep.new_source_config?.connection_options, secret_key: e.target.value } 
                          },
                          connectionChecked: false
                        })}
                      />
                    </div>
                  </>
                )}

                <div style={{ gridColumn: '1 / -1', marginTop: '12px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={onCheckSource} 
                    disabled={isCheckingSource}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px' }}
                  >
                    {isCheckingSource ? <div className="spinner spinner-sm"/> : 'Kiểm tra kết nối kho lưu trữ'}
                  </button>
                </div>

                {sourceStep.connectionChecked && (
                  <div style={{ color: '#10b981', fontSize: '13px', gridColumn: '1 / -1', fontWeight: 500, textAlign: 'center', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
                    ✓ Kết nối thành công
                  </div>
                )}
                {sourceStep.connectionError && (
                  <div style={{ color: '#ef4444', fontSize: '13px', gridColumn: '1 / -1', fontWeight: 500, textAlign: 'center', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
                    ✗ Lỗi: {sourceStep.connectionError}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

Step2Source.displayName = 'Step2Source';
