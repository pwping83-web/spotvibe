import React from 'react';
import { LOCATION_REALTIME_INFO_LINES } from '@/app/constants/locationRealtimeInfo';
import { cn } from '@/app/components/ui/utils';

export function LocationRealtimeInfoBlock({
  className,
  bulletClassName,
}: {
  className?: string;
  bulletClassName?: string;
}) {
  return (
    <ul className={cn('space-y-1.5', className)}>
      {LOCATION_REALTIME_INFO_LINES.map((line) => (
        <li key={line} className="flex gap-2 text-left">
          <span className={cn('shrink-0 select-none text-white/30', bulletClassName)}>·</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
