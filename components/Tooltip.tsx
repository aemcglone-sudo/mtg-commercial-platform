'use client';

import { useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export default function Tooltip({ text, children, side = 'top', delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-zinc-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-zinc-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-[-4px] top-1/2 -translate-y-1/2 border-l-zinc-700 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-[-4px] top-1/2 -translate-y-1/2 border-r-zinc-700 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {isVisible && (
        <div className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-zinc-700 rounded whitespace-nowrap pointer-events-none ${positionClasses[side]}`}>
          {text}
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[side]}`} />
        </div>
      )}
    </div>
  );
}
