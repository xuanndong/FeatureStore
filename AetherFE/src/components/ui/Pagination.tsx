import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
      <button
        className="btn-ghost"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{ fontSize: '13px', padding: '4px 8px', border: 'none' }}
      >
        Trước
      </button>
      <div style={{ display: 'flex', gap: '4px' }}>
        {getPages().map((page, i) => (
          page === '...' ? (
            <span key={i} style={{ padding: '4px 8px', color: 'var(--text-muted)' }}>...</span>
          ) : (
            <button
              key={i}
              onClick={() => onPageChange(page as number)}
              style={{
                width: '28px', height: '28px', borderRadius: '4px', border: 'none',
                background: currentPage === page ? 'var(--text-primary)' : 'transparent',
                color: currentPage === page ? 'var(--bg)' : 'var(--text-primary)',
                cursor: 'pointer', fontSize: '13px', fontWeight: currentPage === page ? 600 : 400
              }}
            >
              {page}
            </button>
          )
        ))}
      </div>
      <button
        className="btn-ghost"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{ fontSize: '13px', padding: '4px 8px', border: 'none' }}
      >
        Sau
      </button>
    </div>
  );
};
