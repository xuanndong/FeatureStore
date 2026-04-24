import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from '@/router';
import { NotificationProvider } from '@/components/ui/Notification';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AppRouter />
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
