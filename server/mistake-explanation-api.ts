import { nodeMiddleware, jsonResponse, readRequestJson } from './http-transport';
import { mistakeEvidence, sanitizeMistakeRequest, validateMistakeExplanation } from '../src/mistake-explanation';
import { rhythmPattern } from '../src/adaptive-coach';

export function createMistakeExplanationMiddleware(apiKey: string, provider: typeof fetch = fetch) {
  return nodeMiddleware(createMistakeExplanationHandler(apiKey, provider), ['/api/mistake-explanation']);
}

export function createMistakeExplanationHandler(apiKey: string, provider: typeof fetch = fetch) {
  return async (req: Request): Promise<Response | null> => {
    if (new URL(req.url).pathname !== '/api/mistake-explanation') { return null; }
    if (req.method !== 'POST') { return jsonResponse(405,{error:'Method not allowed.'}); }
    if (!apiKey) { return jsonResponse(503,{error:'Configure OPENAI_API_KEY in .env.local and restart Vite.'}); }
    let request;
    try { request=sanitizeMistakeRequest(await readRequestJson(req,16000)); } catch { request=null; }
    if (!request) { return jsonResponse(400,{error:'This selected hit has no usable timing evidence. Record a clearer take or select another mistake.'}); }
    const {hit,focus,metrics}=mistakeEvidence(request);
    const pattern=rhythmPattern(request.patternId);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await provider('https://api.openai.com/v1/responses',{
        method:'POST', headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal, req.signal]),
        body:JSON.stringify({model:'gpt-6-astra',store:false,reasoning:{effort:'low'},max_output_tokens:650,
          instructions:'Explain one selected ukulele timing mistake to a beginner. Use only supplied measurements; no audio or hand observations are available. A missed event means no attack was matched, not proof the player did not strum. Give one actionable instruction, not a diagnosis of technique or ability. Do not invent numerical facts: the UI displays exact measured offsets separately. Call explain_mistake exactly once with the selected eventIndex and a lower BPM than the take. Recipe only changes the teaching hint, never the song, chord, strokes, direction or rests. Do not claim to hear audio or recognize chords.',
          input:JSON.stringify({patternTitle:pattern.title,notation:pattern.notation,bpm:request.bpm,selected:{eventIndex:hit.eventIndex,slot:hit.slot,cycle:hit.cycle,grade:hit.grade,deltaMs:hit.deltaMs},focus,nearby:metrics.alignedHits.filter(h=>h.cycle===hit.cycle&&h.slot>=focus.startSlot&&h.slot<=focus.endSlot).map(h=>({slot:h.slot,grade:h.grade,deltaMs:h.deltaMs})),captureQuality:request.captureQuality}),
          tools:[{type:'function',name:'explain_mistake',description:'Explain the selected measurement and select a slower exact-passage demonstration.',strict:true,parameters:{type:'object',properties:{eventIndex:{type:'integer'},recipe:{type:'string',enum:['steady-spacing','unhurried-return','preserve-rest']},explanation:{type:'string',description:'One beginner-friendly instruction, at most 220 characters.'},bpm:{type:'integer',enum:[40,45,50,55,60,65]}},required:['eventIndex','recipe','explanation','bpm'],additionalProperties:false}}],tool_choice:{type:'function',name:'explain_mistake'},parallel_tool_calls:false}),
      });
      if (!response.ok) { return jsonResponse(response.status,{error:response.status===429?'Astra is busy or the API limit was reached. Retry this explanation shortly.':'Astra could not explain this hit. Your take is kept; try again.'}); }
      const payload=await response.json() as {output?:{type?:string;name?:string;arguments?:string}[]};
      const calls=Array.isArray(payload.output)?payload.output.filter(c=>c.type==='function_call'):[];
      let explanation=null;
      if(calls.length===1&&calls[0].name==='explain_mistake') {
        try { explanation=validateMistakeExplanation(JSON.parse(calls[0].arguments??''),request); } catch { /* invalid tool arguments stay retryable */ }
      }
      if(!explanation) { return jsonResponse(502,{error:'Astra returned an explanation that did not match this hit. Retry explanation.'}); }
      return jsonResponse(200,{explanation});
    } catch { return jsonResponse(504,{error:'The explanation could not finish. Your take is kept; retry when ready.'}); }
    finally { clearTimeout(timer); }
  };
}
