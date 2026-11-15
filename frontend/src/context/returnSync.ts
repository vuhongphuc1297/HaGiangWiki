type EventSource = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
type VisibilitySource = EventSource & { readonly visibilityState: string };

// Mobile browsers emit focus and visibilitychange together in either order.
// Consume one away interval once; do not poll while the app is being used.
export function attachReturnSync({ document, window, refresh, now = Date.now, thresholdMs = 30_000 }: {
  document: VisibilitySource; window: EventSource; refresh: () => void;
  now?: () => number; thresholdMs?: number;
}) {
  let awaySince: number | null = document.visibilityState === 'hidden' ? now() : null;
  const leave = () => { awaySince ??= now(); };
  const resume = () => {
    if (document.visibilityState !== 'visible' || awaySince === null) return;
    const elapsed = now() - awaySince;
    awaySince = null;
    if (elapsed >= thresholdMs) refresh();
  };
  const visibilityChanged = () => { if (document.visibilityState === 'hidden') leave(); else resume(); };
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('blur', leave);
  window.addEventListener('focus', resume);
  return () => {
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('blur', leave);
    window.removeEventListener('focus', resume);
  };
}
