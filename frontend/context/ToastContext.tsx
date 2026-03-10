import React, { createContext, useContext, useCallback, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  React.useEffect(() => {
    console.log('🔔 Toasts updated:', toasts);
  }, [toasts]);

  const removeToast = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 3500) => {
      const id = crypto.randomUUID();
      console.log('✅ showToast called:', type, message, id);
      setToasts((prev) => {
        console.log('✅ Setting toasts. Previous:', prev);
        return [...prev, { id, type, message }];
      });
      const timeout = setTimeout(() => {
        console.log('⏰ Toast timeout reached for id:', id);
        removeToast(id);
      }, duration);
      timeoutRefs.current.set(id, timeout);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
