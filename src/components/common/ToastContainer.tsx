import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  const getToastIcon = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-indigo-500 shrink-0" />;
    }
  };

  const getToastStyle = (type: ToastItem['type']) => {
    switch (type) {
      case 'success':
        return 'border-emerald-200 bg-white text-slate-800 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/20';
      case 'error':
        return 'border-rose-200 bg-white text-slate-800 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/20';
      case 'warning':
        return 'border-amber-200 bg-white text-slate-800 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/20';
      case 'info':
      default:
        return 'border-indigo-200 bg-white text-slate-800 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/20';
    }
  };

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border text-xs transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${getToastStyle(
            t.type
          )}`}
        >
          <div className="mt-0.5">{getToastIcon(t.type)}</div>
          <p className="flex-1 font-medium leading-relaxed">{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

