import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

// Open dialogs, topmost last, so Escape only closes the one in front.
const openStack: string[] = [];

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Shown left of the title, e.g. a warning icon in a confirm dialog. */
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizes;
}

export default function Modal({ open, onClose, title, description, icon, children, footer, size = 'md' }: ModalProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    openStack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>('input, select, textarea') ?? panel).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openStack[openStack.length - 1] === id) onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      openStack.splice(openStack.indexOf(id), 1);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, id]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div className="fixed inset-0 animate-fade-in bg-gray-950/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className={clsx(
          'relative w-full animate-dialog-in rounded-xl border border-line bg-surface shadow-overlay outline-none',
          sizes[size],
        )}
      >
        <div className="flex items-start gap-4 px-6 pb-4 pt-5">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-fg-subtle">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon -mr-2 -mt-1" aria-label="Close">
            <X />
          </button>
        </div>
        {children && (
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto border-t border-line px-6 py-5">{children}</div>
        )}
        {footer && (
          <div className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-line bg-surface-subtle/60 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
