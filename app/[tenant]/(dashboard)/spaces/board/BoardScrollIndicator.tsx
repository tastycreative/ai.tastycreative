'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface BoardScrollIndicatorProps {
  totalColumns: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function BoardScrollIndicator({
  totalColumns,
  containerRef,
}: BoardScrollIndicatorProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleRatio, setVisibleRatio] = useState(1);
  const [hasScroll, setHasScroll] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScrollInfo = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;

      const scrollable = scrollWidth > clientWidth + 1;
      setHasScroll(scrollable);

      if (!scrollable) {
        setVisibleRatio(1);
        setScrollProgress(0);
        return;
      }

      const maxScroll = scrollWidth - clientWidth;
      setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0);
      setVisibleRatio(clientWidth / scrollWidth);
    };

    // Delay first read so the DOM has finished laying out new columns
    const raf = requestAnimationFrame(updateScrollInfo);

    container.addEventListener('scroll', updateScrollInfo);
    window.addEventListener('resize', updateScrollInfo);

    const resizeObserver = new ResizeObserver(updateScrollInfo);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', updateScrollInfo);
      window.removeEventListener('resize', updateScrollInfo);
      resizeObserver.disconnect();
    };
  }, [containerRef, totalColumns]);

  if (!mounted || totalColumns < 2) return null;

  const viewportWidth = visibleRatio * 100;
  const viewportLeft = scrollProgress * (100 - viewportWidth);

  return createPortal(
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      <div className="rounded-lg bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-brand-mid-pink/30 shadow-lg p-1 backdrop-blur-sm">
        <div className="relative w-32 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          {/* Column segments */}
          <div className="absolute inset-0 flex gap-px">
            {Array.from({ length: totalColumns }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-gray-300/50 dark:bg-gray-700/50"
              />
            ))}
          </div>

          {/* Viewport indicator — full width when no scroll, sized when scrollable */}
          <div
            className="absolute top-0 bottom-0 bg-brand-light-pink/40 dark:bg-brand-light-pink/30 border-2 border-brand-light-pink dark:border-brand-mid-pink rounded-md transition-all duration-100"
            style={
              hasScroll
                ? { left: `${viewportLeft}%`, width: `${viewportWidth}%` }
                : { left: 0, width: '100%' }
            }
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
