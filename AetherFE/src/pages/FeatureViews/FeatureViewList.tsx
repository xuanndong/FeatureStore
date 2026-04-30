import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Layers, Clock, Database, AlertTriangle, X, Info } from 'lucide-react';
import { viewsApi } from '@/services/views';
import type { MaterializationJob, FeatureView } from '@/types';
import { useNotification } from '@/components/ui/Notification';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface Props {
  onCreateNew: () => void;
  onViewDetail: (id: string) => void;
}

export const FeatureViewList: React.FC<Props> = ({ onCreateNew, onViewDetail }) => {
  const { showNotification } = useNotification();
  const [jobs, setJobs] = useState<MaterializationJob[]>([]);
  
  // State lưu trữ thông tin chi tiết của Feature View (Map theo viewId)
  const [viewDetails, setViewDetails] = useState<Record<string, FeatureView>>({});
  
  const [loading, setLoading] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    jobId: string;
    viewId: string;
  }>({
    isOpen: false,
    jobId: '',
    viewId: '',
  });
  
  const [isModalRendered, setIsModalRendered] = useState(false);
  
  // Search & Pagination State
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [totalPages, setTotalPages] = useState(1);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await viewsApi.listMaterializationJobs(undefined, undefined, currentPage, itemsPerPage);
      
      const dataArray = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setJobs(dataArray);
      
      if (res.data?.pagination?.total_pages) {
        setTotalPages(res.data.pagination.total_pages);
      } else {
        setTotalPages(1);
      }

      // ======================================================================
      // LOGIC LÀM GIÀU DỮ LIỆU (ENRICH DATA): LẤY THÊM TÊN FEATURE VIEW
      // ======================================================================
      if (dataArray.length > 0) {
        // 1. Lấy danh sách ID duy nhất để tránh gọi API trùng lặp
        const uniqueViewIds = [...new Set(dataArray.map((j: MaterializationJob) => j.feature_view_id))] as string[];
        
        // 2. Gọi API đồng thời (Parallel) để lấy chi tiết
        const detailsPromises = uniqueViewIds.map(id => 
            viewsApi.getFeatureViewDetail(id).catch(() => null) // Bắt lỗi để không tịt cả chùm
        );
        const detailsResults = await Promise.all(detailsPromises);

        // 3. Đưa vào object map để UI dễ truy xuất O(1)
        const newDetailsMap: Record<string, FeatureView> = {};
        detailsResults.forEach(response => {
            if (response && response.data) {
                newDetailsMap[response.data.id] = response.data;
            }
        });
        
        setViewDetails(prev => ({ ...prev, ...newDetailsMap }));
      }

    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Lỗi tải danh sách Jobs');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, showNotification]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    let ws: WebSocket;
    try {
      const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace('http', 'ws') + '/views/ws/materialization';
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'MATERIALIZATION_JOB_UPDATE') {
          const payload = data.data;
          setJobs(prevJobs => prevJobs.map(j => {
            if (j.id === payload.id) {
               return { ...j, status: payload.status, updated_at: payload.updated_at, message: payload.message };
            }
            return j;
          }));
        }
      };
    } catch (error) {
      console.error('WS Error:', error);
    }
    
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const openConfirmModal = (jobId: string, viewId: string) => {
    setConfirmModal({ isOpen: true, jobId, viewId });
    setIsModalRendered(true);
  };

  const closeConfirmModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setTimeout(() => {
      setIsModalRendered(false);
    }, 200);
  }, []);

  const handleConfirmDelete = async () => {
    const { viewId } = confirmModal;
    if (!viewId) return;
    
    try {
      await viewsApi.deleteFeatureView(viewId);
      showNotification('success', `Đã xóa Feature View`);
      closeConfirmModal();
      fetchJobs();
    } catch (err: any) {
      showNotification('error', err.response?.data?.detail || 'Xóa thất bại');
      closeConfirmModal();
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>     
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Quản lý Materialization Jobs</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Danh sách các tiến trình đóng gói Feature View.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" className="form-input" placeholder="Tìm kiếm Job..." style={{ paddingLeft: '36px' }}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={onCreateNew} style={{ gap: '8px', padding: '10px 20px' }}>
            <Plus size={18} /> Tạo mới View
          </button>
        </div>
      </div>

      {/* CARDS */}
      {loading ? (
        <div className="spinner" style={{ margin: '60px auto' }}></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state" style={{ padding: '80px 20px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <Layers size={48} color="var(--border)" style={{ marginBottom: '16px' }} />
          <h3>Chưa có Job nào</h3>
          <p>Chưa có tiến trình vật lý hóa dữ liệu.</p>
        </div>
      ) : (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
            gap: '20px' 
          }}>
            {jobs.map(job => {
              // Lấy thông tin chi tiết View từ State Map
              const viewInfo = viewDetails[job.feature_view_id];
              const viewName = viewInfo?.name || "Đang tải...";

              return (
                <div key={job.id} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                className="view-card" 
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'var(--primary-light)', padding: '10px', borderRadius: '8px', color: 'var(--primary)' }}>
                        <Layers size={20} />
                      </div>
                      <div>
                        {/* Hiển thị Tên View nổi bật, nhét ID xuống dưới dạng phụ */}
                        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                          {viewName}
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ID: {job.feature_view_id.split('-')[0]}...
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => openConfirmModal(job.id, job.feature_view_id)}
                      style={{ background: 'var(--bg-secondary)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '6px' }}
                      title="Xóa View"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Status Wrapper */}
                  <div style={{ display: 'flex', gap: '12px', background: 'var(--surface)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Database size={12} /> SỐ LƯỢNG ĐẶC TRƯNG
                      </span>
                      {/* Hiển thị thêm số lượng cột (features) nếu có thông tin */}
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                         {viewInfo ? `${viewInfo.features?.length || 0} đặc trưng` : '--'}
                      </span>
                    </div>
                    <div style={{ width: '1px', background: 'var(--border)' }}></div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> TRẠNG THÁI
                      </span>
                      <StatusBadge execution={job.status} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: 'auto' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Ngày tạo: {new Date(job.created_at * 1000).toLocaleDateString('vi-VN')}
                    </span>
                    <button
                      onClick={() => onViewDetail(job.feature_view_id)}
                      style={{ 
                        fontSize: '12px', fontWeight: 500, color: 'var(--primary)', cursor: job.status !== 'COMPLETED' ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', padding: 0,
                        opacity: job.status !== 'COMPLETED' ? 0.5 : 1
                      }}
                      disabled={job.status !== 'COMPLETED'}
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER: (PAGINATION) */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>              
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      {/* MODAL XÁC NHẬN XÓA */}
      {isModalRendered && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: confirmModal.isOpen ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
        }}
        onClick={closeConfirmModal}
        >
          <div style={{ 
            width: '450px', 
            backgroundColor: 'var(--bg)', 
            borderRadius: '12px', 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            transform: confirmModal.isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
            transition: 'transform 0.2s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--border)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
                <AlertTriangle size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Xác nhận xóa hành động</h3>
              </div>
              <button 
                onClick={closeConfirmModal}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '24px 20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                Bạn có chắc chắn muốn xóa Feature View <strong style={{color: 'var(--primary)'}}>
                  "{viewDetails[confirmModal.viewId]?.name || confirmModal.viewId}"
                </strong> không?
              </p>
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.05)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                color: '#ef4444', 
                padding: '12px', 
                borderRadius: '8px', 
                fontSize: '13px',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <Info size={28} style={{flexShrink: 0, marginTop: '2px'}}/>
                <div>
                  <strong>Cảnh báo quan trọng:</strong> Hành động này sẽ xóa vĩnh viễn "bản thiết kế" Metadata của View này khỏi hệ thống. Nó không thể được hoàn tác.
                </div>
              </div>
            </div>
            
            <div style={{ 
              padding: '16px 20px', 
              borderTop: '1px solid var(--border)', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px',
              background: 'var(--bg-secondary)'
            }}>
              <button className="btn btn-ghost" onClick={closeConfirmModal}>
                Hủy bỏ
              </button>
              <button 
                className="btn btn-primary" 
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', padding: '10px 20px' }} 
                onClick={handleConfirmDelete}
              >
                <Trash2 size={16} style={{marginRight: '6px'}}/> Xác nhận xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
