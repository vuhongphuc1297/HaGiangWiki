import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';

export function MobileContainer({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'max-w-[420px] mx-auto min-h-screen bg-bg-page text-text-main shadow-2xl relative flex flex-col font-sans',
        'min-h-dvh',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
