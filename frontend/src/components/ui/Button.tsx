import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';

type Props = ComponentPropsWithoutRef<'button'> & { tone?: 'primary' | 'secondary' | 'quiet' | 'danger' };
export function Button({ className, tone = 'primary', type = 'button', ...props }: Props) {
  return <button type={type} className={cn(
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-btn px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none',
    tone === 'primary' && 'border border-accent bg-accent text-surface hover:bg-accent/90',
    tone === 'secondary' && 'border border-border-main bg-surface text-accent hover:bg-accent-soft',
    tone === 'quiet' && 'text-text-muted hover:bg-accent-soft',
    tone === 'danger' && 'border border-state-error bg-state-error text-surface hover:bg-state-error/90',
    className,
  )} {...props} />;
}
