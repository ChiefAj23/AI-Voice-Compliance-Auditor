import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

type Notify = (title: string, description?: string) => void;

export interface ToastApi {
  success: Notify;
  error: Notify;
  warning: Notify;
  info: Notify;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneStyle: Record<ToastTone, { icon: LucideIcon; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, className: 'text-red-600 dark:text-red-400' },
  warning: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400' },
  info: { icon: Info, className: 'text-accent-fg' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((items) => [...items.slice(-3), { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      warning: (title, description) => push('warning', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6"
        >
          {toasts.map((toast) => {
            const { icon: Icon, className } = toneStyle[toast.tone];
            return (
              <div
                key={toast.id}
                role={toast.tone === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border border-line bg-surface p-4 shadow-overlay sm:w-96"
              >
                <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', className)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 break-words text-[13px] text-fg-subtle">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="-m-1 rounded p-1 text-fg-faint transition-colors hover:text-fg"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
