import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function ErrorNotice({ children }: { children: ReactNode }) {
  return <div role="alert" className="flex gap-2 rounded-btn border border-state-error/20 bg-state-error/5 p-3 text-sm leading-6 text-state-error"><CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><div>{children}</div></div>;
}

export function Loading({ label = 'Đang tải hành trình…' }: { label?: string }) {
  return <div role="status" className="flex min-h-40 items-center justify-center gap-3 px-5 text-sm text-text-muted"><LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />{label}</div>;
}
