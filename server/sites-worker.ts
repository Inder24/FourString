import { createAdaptiveCoachHandler } from './adaptive-coach-api';
import { createMistakeExplanationHandler } from './mistake-explanation-api';
import { createLessonCoachHandler } from './lesson-coach-api';
import { jsonResponse } from './http-transport';

interface SitesEnvironment {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENAI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: SitesEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    if (request.method === 'POST' && ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site')) {
      return jsonResponse(403, { error: 'Use AI Coach from this site.' });
    }
    const key = env.OPENAI_API_KEY ?? '';
    return await createAdaptiveCoachHandler(key)(request)
      ?? await createMistakeExplanationHandler(key)(request)
      ?? await createLessonCoachHandler(key)(request)
      ?? jsonResponse(404, { error: 'API route not found.' });
  },
};
