import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import type { NotificationItem } from '@/types';

interface NotificationContextType {
  showNotification: (type: NotificationItem['type'], message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const showNotification = useCallback((type: NotificationItem['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="notification-container">
        {notifications.map(n => (
          <div key={n.id} className={`notification notification-${n.type}`}>
            {n.type === 'success' && <CheckCircle2 size={16} />}
            {n.type === 'error' && <XCircle size={16} />}
            {n.type === 'info' && <Info size={16} />}
            {n.message}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};
