'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';

type ToastContextType = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');

  const showToast = useCallback((m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(''), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-[#191F28] text-white px-6 py-4 rounded-2xl shadow-xl z-50 flex items-center w-max max-w-[90vw]">
          <AlertCircle className="w-5 h-5 mr-3 text-red-400 shrink-0" />
          <span className="text-sm font-bold">{message}</span>
          <button
            type="button"
            onClick={() => setMessage('')}
            className="ml-6 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
