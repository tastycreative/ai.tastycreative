"use client";

import { useState, memo } from "react";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const Section = memo(function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[#2d3142] pt-2.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-400 transition-colors"
      >
        {title}
        <svg className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="mt-2 space-y-2.5">{children}</div>}
    </div>
  );
});
