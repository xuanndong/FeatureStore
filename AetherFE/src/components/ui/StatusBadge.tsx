import React from 'react';
import { CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';
import type { Materialization, FeatureGroupStatus } from '@/types';

interface StatusBadgeProps {
  status?: FeatureGroupStatus;
  execution?: Materialization;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, execution }) => {
  if (status) {
    const cls = status === 'ACTIVE' ? 'badge-active' : status === 'DEPRECATED' ? 'badge-deprecated' : 'badge-inactive';
    const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    return <span className={`badge ${cls}`}>{label}</span>;
  }

  if (execution) {
    let cls = 'badge-pending';
    let icon = <Clock size={12} />;
    let label = 'Chờ xử lý';

    if (execution === 'COMPLETED') { cls = 'badge-success'; icon = <CheckCircle2 size={12} />; label = 'Thành công'; }
    if (execution === 'FAILED') { cls = 'badge-failed'; icon = <XCircle size={12} />; label = 'Thất bại'; }
    if (execution === 'RUNNING') { cls = 'badge-running'; icon = <Activity size={12} className="pulse" />; label = 'Đang chạy'; }
    if (execution === 'CANCELED') { cls = 'badge-pending'; icon = <XCircle size={12} />; label = 'Đã hủy'; }

    return <span className={`badge ${cls}`}>{icon} {label}</span>;
  }

  return null;
};

interface BadgeProps {
  label: string;
  variant: 'batch' | 'stream' | 'sql' | 'python' | 'aggregation' | 'default';
}

export const TypeBadge: React.FC<BadgeProps> = ({ label, variant }) => {
  return <span className={`badge badge-${variant}`}>{label}</span>;
};
