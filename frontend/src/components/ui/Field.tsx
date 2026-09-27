import type { ReactNode } from 'react';

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + help or error text, with consistent spacing. */
export default function Field({ label, htmlFor, help, error, required, className, children }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="ml-0.5 text-red-600 dark:text-red-400">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : help ? <p className="help-text">{help}</p> : null}
    </div>
  );
}
