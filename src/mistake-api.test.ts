import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { createMistakeExplanationMiddleware } from '../server/mistake-explanation-api';
const body = { patternId:'steady-downs',bpm:70,repetitions:2,focus:null,detectedAtMs:[0,850,1710,2820,3430,4280,5140,6000],selectedEventIndex:3,captureQuality:{calibrated:true,noiseFloorRms:.002,peakRms:.12,clippedFraction:0,frameCount:240,activeFrameFraction:.3,detectedCount:8,expectedCount:8, maxFrameGapMs: 0} };
async function request(payload:unknown, provider:typeof fetch) {
  const middleware = createMistakeExplanationMiddleware('test-only',provider);
  const server = createServer((req,res)=>void middleware(req,res,()=>{res.statusCode=404;res.end();}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/mistake-explanation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); return {status:response.status,body:await response.json()}; }
  finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
}
it('sends only selected numeric evidence and accepts the bounded tool', async()=>{
  let sent='';
  const result=await request({...body,recordingUrl:'blob:private',waveform:[1]},async(_url,init)=>{
    sent=String(init?.body);
    return Response.json({output:[{type:'function_call',name:'explain_mistake',arguments:JSON.stringify({eventIndex:3,recipe:'steady-spacing',explanation:'Leave the same space before this stroke as the one before it.',bpm:55})}]});
  });
  expect(result.status).toBe(200);
  expect(result.body.explanation.bpm).toBe(55);
  expect(sent).not.toContain('blob:');
  expect(sent).not.toContain('waveform');
  expect(JSON.parse(JSON.parse(sent).input).selected.deltaMs).toBeGreaterThan(200);
});
it('blocks unreliable evidence before a provider call',async()=>{
  let calls=0;
  const result=await request({...body,captureQuality:{...body.captureQuality,clippedFraction:.1}},async()=>{calls++;return Response.json({});});
  expect(result.status).toBe(400); expect(calls).toBe(0);
});
it('keeps provider failures and malformed outputs retryable',async()=>{
  expect((await request(body,async()=>Response.json({}, {status:429}))).status).toBe(429);
  expect((await request(body,async()=>Response.json({output:[]}))).status).toBe(502);
  expect((await request(body,async()=>{throw new DOMException('timeout','AbortError');})).status).toBe(504);
});
