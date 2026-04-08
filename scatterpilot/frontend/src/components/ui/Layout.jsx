import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import authService from '../../services/auth';
import api from '../../services/api';

export default function Layout({ children, onNewInvoice }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [userInitials, setUserInitials] = useState('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userInfo = await authService.getUserInfo();
      const email = userInfo?.email || '';
      setUserEmail(email);

      try {
        const profile = await api.getProfile();
        const name = profile?.contact_name || '';
        if (name.trim()) {
          const parts = name.trim().split(' ');
          setUserInitials(
            parts.length === 1
              ? parts[0][0].toUpperCase()
              : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          );
        } else {
          setUserInitials(email ? email[0].toUpperCase() : 'U');
        }
      } catch {
        setUserInitials(email ? email[0].toUpperCase() : 'U');
      }
    } catch {
      setUserInitials('U');
    }
  };

  const handleNewInvoice = () => {
    if (onNewInvoice) {
      onNewInvoice();
    } else {
      navigate('/app/invoices');
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg">
      <Sidebar
        onNewInvoice={handleNewInvoice}
        userEmail={userEmail}
        userInitials={userInitials}
      />
      <main className="ml-[220px] min-h-screen">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
