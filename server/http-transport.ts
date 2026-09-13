import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiHandler = (request: Request) => Promise<Response | null>;

export function jsonResponse(status: number, value: unknown): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function readRequestJson(request: Request, maximumBytes: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Attempt summary must be valid JSON.');
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new Error('Attempt summary is too large.');
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { reader.releaseLock(); }
}

// Only Vite uses this transport. The Sites worker calls the same Fetch handlers directly.
export function nodeMiddleware(handler: ApiHandler, paths: string[]) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void): Promise<void> => {
    if (!paths.includes((request.url ?? '/').split('?')[0])) { next(); return; }
    const abort = new AbortController();
    const disconnect = () => { if (!response.writableEnded) abort.abort(); };
    response.on('close', disconnect);
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    let canceled = false;
    const body = hasBody ? new ReadableStream<Uint8Array>({
      start(controller) {
        request.on('data', chunk => { if (!canceled) controller.enqueue(new Uint8Array(chunk)); });
        request.on('end', () => { if (!canceled) controller.close(); });
        request.on('error', error => { if (!canceled) controller.error(error); });
      },
      cancel() { canceled = true; request.resume(); },
    }) : undefined;
    try {
      const result = await handler(new Request(new URL(request.url ?? '/', 'http://localhost'), {
        method: request.method, body, signal: abort.signal, duplex: 'half',
      } as RequestInit));
      if (!result) { next(); return; }
      response.statusCode = result.status;
      result.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(await result.text());
    } finally { response.off('close', disconnect); }
  };
}
