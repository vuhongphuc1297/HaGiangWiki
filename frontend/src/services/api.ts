type FieldError = { field: string; message: string };
type ApiOptions = Omit<RequestInit, 'body' | 'credentials'> & { body?: unknown; timeoutMs?: number };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly details: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API path must be relative to /api.');
  const { body, timeoutMs = 15_000, signal, ...requestOptions } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, timeoutMs);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(`/api${path}`, {
      ...requestOptions, headers, credentials: 'include', cache: 'no-store',
      signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
    if (!response.ok) {
      const error = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      const details = Array.isArray(error.details) ? error.details.filter((item): item is FieldError => (
        typeof item === 'object' && item !== null && typeof item.field === 'string' && typeof item.message === 'string'
      )) : [];
      throw new ApiError(typeof error.error === 'string' ? error.error : 'Chưa thể hoàn tất yêu cầu. Hãy thử lại.', response.status, details);
    }
    if (data === undefined && response.status !== 204) throw new ApiError('Phản hồi từ máy chủ chưa hợp lệ. Hãy thử lại.', response.status);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error;
    throw new ApiError(controller.signal.aborted ? 'Yêu cầu mất quá lâu. Hãy thử lại.' : 'Chưa kết nối được. Hãy kiểm tra mạng và thử lại.', 0);
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Hãy thử lại.';
}
