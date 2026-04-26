export const useTimeFormatting = () => {
  const getTimeAgo = (ts: number): string => {
    if (!ts) return 'N/A';
    const seconds = Math.floor(Date.now() / 1000) - ts;
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  return { getTimeAgo };
};
