'use client';

import { User as UserIcon } from 'lucide-react';

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (item: T) => React.ReactNode;
}

interface RecentActivityTableProps<T> {
  title: string;
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function RecentActivityTable<T>({
  title,
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
}: RecentActivityTableProps<T>) {
  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-foreground/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 bg-foreground/10 rounded" />
                <div className="h-2.5 w-24 bg-foreground/10 rounded" />
              </div>
              <div className="h-3 w-16 bg-foreground/10 rounded" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center">
          <UserIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-[#EC67A1]/5 to-[#5DC3F8]/5">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold text-foreground/70 uppercase tracking-wider"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((item, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`${
                    rowIndex % 2 === 0 ? 'bg-card/30' : 'bg-accent/30'
                  } hover:bg-[#EC67A1]/5 transition-colors`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-xs text-foreground/80">
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
