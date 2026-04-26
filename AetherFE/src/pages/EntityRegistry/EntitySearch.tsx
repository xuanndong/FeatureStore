import React from 'react';
import { Search } from 'lucide-react';

interface EntitySearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const EntitySearch: React.FC<EntitySearchProps> = ({ value, onChange }) => {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
      <Search 
        size={16}
        style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)'
        }} 
      />
      <input
        type="text"
        placeholder="Tìm kiếm thực thể hoặc khóa..."
        className="form-input"
        style={{ paddingLeft: '40px', height: '40px', borderRadius: '20px' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
