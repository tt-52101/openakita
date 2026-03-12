/**
 * fetch wrapper: 在 HTTP 4xx/5xx 时自动抛异常（原生 fetch 只在网络错误时才抛）。
 * 所有对后端 API 的调用都应使用此函数，以确保错误被正确捕获。
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const effectiveInit = init?.signal ? init : { ...init, signal: AbortSignal.timeout(10_000) };
  const res = await fetch(url, effectiveInit);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.text();
      if (body) detail = body.slice(0, 200);
    } catch { /* ignore */ }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return res;
}
