import { Layers, Eye, Database, Fingerprint, RefreshCcw } from 'lucide-react';
import type { QuickLinkItem } from '@/pages/Dashboard/QuickLinkCard';

export const QUICK_LINKS_DATA: QuickLinkItem[] = [
  {
    title: 'Feature Groups',
    desc: 'Tổ chức và quản lý các nhóm đặc trưng dữ liệu từ nhiều nguồn khác nhau.',
    icon: Layers,
    path: '/feature-groups',
  },
  {
    title: 'Data Sources',
    desc: 'Quản lý các kết nối lưu trữ dữ liệu Batch (S3, Local) và luồng Stream.',
    icon: Database,
    path: '/data-sources',
  },
  {
    title: 'Entities',
    desc: 'Định nghĩa các thực thể logic và khóa liên kết (Join Key) cho mô hình AI.',
    icon: Fingerprint,
    path: '/entities',
  },
  {
    title: 'Materialization',
    desc: 'Đồng bộ hóa dữ liệu giữa các kho lưu trữ offline và online.',
    icon: RefreshCcw,
    path: '/materialization',
  },
  {
    title: 'Feature Views',
    desc: 'Đóng gói các đặc trưng để sẵn sàng phục vụ cho mô hình AI.',
    icon: Eye,
    path: '/feature-views',
  },
];
