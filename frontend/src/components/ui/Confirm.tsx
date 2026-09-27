import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button. Defaults to 'danger'. */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Promise-based replacement for window.confirm: `if (!(await confirm({...}))) return;` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const danger = (options?.tone ?? 'danger') === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => settle(false)}
        size="sm"
        title={options?.title ?? ''}
        description={options?.description}
        icon={
          danger ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : undefined
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => settle(false)}>
              {options?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={danger ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={() => settle(true)}
              autoFocus
            >
              {options?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context;
}
