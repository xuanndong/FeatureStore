import React from 'react';
import { Search } from 'lucide-react';

interface DataSourceSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export const DataSourceSearch: React.FC<DataSourceSearchProps> = ({
  value,
  onChange,
  onSearch,
}) => {
  return (
    <div style={{ position: 'relative', width: '320px' }}>
      <Search
        size={16}
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }}
      />
      <input
        type="text"
        placeholder="Tìm kiếm nguồn dữ liệu..."
        className="form-input"
        style={{ paddingLeft: '36px', height: '38px', borderRadius: '20px' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
      />
    </div>
  );
};
