import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages,
  onPageChange 
}) => {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const range = (start: number, end: number) => {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    if (totalPages <= 7) return range(1, totalPages);
    if (currentPage <= 4) return [...range(1, 5), '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', ...range(totalPages - 4, totalPages)];
    
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      gap: '8px', 
      marginTop: '24px',
      userSelect: 'none'
    }}>
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '14px', padding: '6px 12px', border: 'none',
          background: 'transparent', 
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          opacity: currentPage === 1 ? 0.4 : 1,
          color: 'var(--text-primary)',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => { if (currentPage !== 1) e.currentTarget.style.color = '#3b82f6'; }}
        onMouseOut={(e) => { if (currentPage !== 1) e.currentTarget.style.color = 'var(--text-primary)'; }}
      >
        <ChevronLeft size={16} /> Previous
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {getPages().map((page, i) => (
          page === '...' ? (
            <span key={`dots-${i}`} style={{ padding: '0 8px', color: 'var(--text-muted)' }}>...</span>
          ) : (
            <button
              key={`page-${i}-${page}`}
              onClick={() => onPageChange(page as number)}
              style={{
                minWidth: '32px', height: '32px',
                padding: '0 8px',
                borderRadius: '8px',
                border: currentPage === page ? '1px solid #e2e8f0' : '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: currentPage === page ? 500 : 400,
                boxShadow: currentPage === page ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onMouseOver={(e) => {
                if (currentPage !== page) e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseOut={(e) => {
                if (currentPage !== page) e.currentTarget.style.background = 'transparent';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {page}
            </button>
          )
        ))}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '14px', padding: '6px 12px', border: 'none',
          background: 'transparent', 
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          opacity: currentPage === totalPages ? 0.4 : 1,
          color: 'var(--text-primary)',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => { if (currentPage !== totalPages) e.currentTarget.style.color = '#3b82f6'; }}
        onMouseOut={(e) => { if (currentPage !== totalPages) e.currentTarget.style.color = 'var(--text-primary)'; }}
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
};
