const UPSTREAM_TIMEOUT_MS = 5000;

export async function fetchExternalJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`External service returned HTTP ${response.status}`);
  }
  return response.json();
}
