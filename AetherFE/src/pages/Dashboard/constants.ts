import { Layers, Search, RefreshCcw, Eye } from 'lucide-react';
import type { QuickLinkItem } from '@/pages/Dashboard/QuickLinkCard';

export const QUICK_LINKS_DATA: QuickLinkItem[] = [
  {
    title: 'Feature Groups',
    desc: 'Tổ chức và quản lý các nhóm đặc trưng dữ liệu từ nhiều nguồn khác nhau.',
    icon: Layers,
    path: '/feature-groups',
  },
  {
    title: 'Online Explorer',
    desc: 'Truy vấn và kiểm tra dữ liệu đặc trưng trong thời gian thực từ Redis.',
    icon: Search,
    path: '/online-explorer',
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
