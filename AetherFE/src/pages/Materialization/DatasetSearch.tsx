import React from 'react';
import { Search } from 'lucide-react';

interface DatasetSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DatasetSearch: React.FC<DatasetSearchProps> = ({ value, onChange, placeholder = "Tìm kiếm..." }) => {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
      <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      <input
        type="text"
        placeholder={placeholder}
        className="form-input"
        style={{ paddingLeft: '40px', height: '40px', borderRadius: '20px', width: '100%' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
