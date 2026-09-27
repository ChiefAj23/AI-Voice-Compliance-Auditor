import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface ChartTooltipProps extends TooltipProps<ValueType, NameType> {
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: string | number) => string;
}

function formatValue(value: ValueType | undefined, valueFormatter?: (value: number) => string) {
  const format = (v: number | string) => (valueFormatter && typeof v === 'number' ? valueFormatter(v) : String(v));
  if (Array.isArray(value)) return value.map(format).join('–');
  return value === undefined ? '—' : format(value);
}

/** Recharts tooltip in the app's surface style: value first, series name second. */
export default function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[9rem] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-overlay">
      {label !== undefined && label !== '' && (
        <p className="mb-1.5 font-medium text-fg-subtle">{labelFormatter ? labelFormatter(label) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={`${String(entry.dataKey ?? entry.name)}-${index}`} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
            <span className="font-semibold tabular-nums text-fg">{formatValue(entry.value, valueFormatter)}</span>
            <span className="text-fg-subtle">{entry.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
