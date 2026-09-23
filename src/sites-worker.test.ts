import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../server/sites-worker';

const assets = { fetch: async (request: Request) => new Response(new URL(request.url).pathname === '/' ? '<html>FourString</html>' : 'sample', { headers: { 'Content-Type': 'text/plain' } }) };
const env = { ASSETS: assets, OPENAI_API_KEY: 'test-only-not-a-key' };
const request = (path: string, body?: string) => new Request(`https://fourstring.example${path}`, body === undefined ? undefined : { method: 'POST', body });

afterEach(() => vi.unstubAllGlobals());
describe('Sites worker transport', () => {
  it('serves instrument assets, not API fallback HTML', async () => {
    expect(await (await worker.fetch(request('/'), env)).text()).toContain('FourString');
    expect(await (await worker.fetch(request('/samples/note.flac'), env)).text()).toBe('sample');
    expect((await worker.fetch(request('/api/missing'), env)).status).toBe(404);
  });
  it('reports configuration without exposing the secret', async () => {
    const response = await worker.fetch(request('/api/adaptive-coach/status'), env);
    expect(await response.json()).toEqual({ configured: true });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(await (await worker.fetch(request('/api/adaptive-coach/status'), { ASSETS: assets })).json()).toEqual({ configured: false });
  });
  it.each(['/api/adaptive-coach', '/api/mistake-explanation', '/api/lesson-coach'])('preserves validation and missing-key errors for %s', async (path) => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    expect((await worker.fetch(request(path), env)).status).toBe(405);
    expect((await worker.fetch(request(path, '{}'), { ASSETS: assets })).status).toBe(503);
    expect((await worker.fetch(request(path, '{bad'), env)).status).toBe(400);
    expect((await worker.fetch(request(path, '{}'), env)).status).toBe(400);
    expect((await worker.fetch(request(path, JSON.stringify({audio: 'x'.repeat(21000)})), env)).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('rejects cross-origin POSTs before using the API key', async () => {
    const response = await worker.fetch(new Request('https://fourstring.example/api/adaptive-coach', { method: 'POST', headers: { Origin: 'https://unrelated.example' }, body: '{}' }), env);
    expect(response.status).toBe(403);
  });
});
