import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** "View as table" disclosure under a chart, so every plotted value is readable without hovering. */
export default function TableView({ children }: { children: ReactNode }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-3 text-[13px] font-medium text-fg-subtle transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        View as table
      </summary>
      <div className="max-h-72 overflow-auto border-t border-line">{children}</div>
    </details>
  );
}
