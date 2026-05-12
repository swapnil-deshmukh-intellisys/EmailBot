export async function apiFetchJson(path, options = {}) {
  const url = String(path || '').startsWith('/api/') ? path : `/api/${String(path || '').replace(/^\/+/, '')}`;
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const message = response.headers.get('content-type')?.includes('text/html')
        ? `API returned HTML instead of JSON: ${url}`
        : `API returned invalid JSON: ${url}`;
      throw new Error(message);
    }
  }

  if (!response.ok || data?.success === false || data?.ok === false) {
    const fallbackByStatus = {
      401: 'Login expired. Please sign in again.',
      403: 'You do not have permission for this request.',
      404: `API route not found: ${url}`,
      500: 'Server error. Check application logs.'
    };
    throw new Error(data?.message || data?.error || data?.code || fallbackByStatus[response.status] || `Request failed: ${url}`);
  }

  return data;
}
