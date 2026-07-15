import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

interface NotificationContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmModal(options);
  }, []);

  const handleConfirm = () => {
    if (confirmModal) {
      confirmModal.onConfirm();
      setConfirmModal(null);
    }
  };

  const handleCancel = () => {
    if (confirmModal) {
      if (confirmModal.onCancel) confirmModal.onCancel();
      setConfirmModal(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Container */}
      <div className="fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-3 pointer-events-none sm:inset-x-auto sm:bottom-6 sm:right-6">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl glass backdrop-blur-2xl border min-w-0 sm:min-w-[300px] shadow-2xl animate-fade-in-up transition-all ${
              t.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
              t.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' :
              t.type === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
              'border-violet-500/30 bg-violet-500/10 text-violet-300'
            }`}
          >
            <span className="text-xl">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="font-semibold text-sm">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={handleCancel} />
          <div className="glass rounded-[2.5rem] p-8 w-full max-w-md animate-fade-in-up relative overflow-hidden bg-[#0a0a0f] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${confirmModal.variant === 'danger' ? 'bg-red-500' : 'bg-violet-500'}`} />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
            
            <h3 className="text-2xl font-black text-white mb-3 relative z-10 tracking-tight">
              {confirmModal.title}
            </h3>
            <p className="text-gray-400 mb-8 relative z-10 leading-relaxed font-medium">
              {confirmModal.message}
            </p>
            
            <div className="flex gap-3 relative z-10">
              <button
                onClick={handleCancel}
                className="flex-1 px-6 py-3.5 rounded-2xl text-base font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
              >
                {confirmModal.cancelText || 'Hủy'}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-2 px-8 py-3.5 rounded-2xl text-base font-extrabold shadow-lg transition-all hover:scale-[1.03] active:scale-95 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                    : 'btn-primary shadow-violet-500/20'
                }`}
              >
                {confirmModal.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
