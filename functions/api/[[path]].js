export async function onRequest(context) {
  const { request, params } = context;
  const pathSegments = params.path
    ? Array.isArray(params.path)
      ? params.path.join('/')
      : params.path
    : '';
  const url = new URL(request.url);
  const targetUrl = `https://hagiangwiki-api.onrender.com/api/${pathSegments}${url.search}`;

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  });

  try {
    const response = await fetch(modifiedRequest);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: err?.message || String(err) }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
