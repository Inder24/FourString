import type { RhythmAttempt } from './adaptive-coach';
import { buildMistakeRequest, DEMO_RECIPES, mistakeEvidence, recordingPassage, validateMistakeExplanation, type MistakeRequest } from './mistake-explanation';

interface MistakePanelOptions { play: (request:MistakeRequest,bpm:number)=>Promise<void>; stop:()=>void; }
export class MistakePanel {
  private request: MistakeRequest | null = null;
  private recordingUrl: string | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private playbackGeneration = 0;
  private replay: HTMLAudioElement | null = null;
  private replayTimer = 0;
  private requestTimer = 0;
  constructor(private root:HTMLElement, private options:MistakePanelOptions) {
    this.button('explain').addEventListener('click',()=>void this.explain());
    this.button('demo').addEventListener('click',()=>void this.demonstrate());
    this.button('stop').addEventListener('click',()=>this.stop());
    this.button('replay').addEventListener('click',()=>void this.playPassage());
    this.element('tempo').addEventListener('change',()=>this.stop());
  }
  select(attempt:RhythmAttempt,eventIndex:number): boolean {
    const request=buildMistakeRequest(attempt,eventIndex);
    if(!request) return false;
    this.reset();
    this.request=request; this.recordingUrl=attempt.recordingUrl;
    this.root.hidden=false;
    const {hit,focus}=mistakeEvidence(request);
    this.text('evidence',`Loop ${hit.cycle+1} · beat ${1+Math.floor(hit.slot/2)}${hit.slot%2?' &':''}: ${hit.deltaMs===null?'no attack matched':`${Math.abs(hit.deltaMs)} ms ${hit.deltaMs<0?'early':'late'}`}. Device delay removed.`);
    this.text('range',`Exact passage · slots ${focus.startSlot+1}–${focus.endSlot+1} · ${attempt.bpm} BPM in your take`);
    this.text('answer','Ask Astra for one suggestion based on this measured event.');
    this.text('recipe','');
    this.text('status','Selected passage ready. Demonstrations never record your microphone.');
    this.element('attribution').hidden=true;
    const tempo=this.element<HTMLSelectElement>('tempo');
    tempo.replaceChildren(...[40,45,50,55,60,65].filter(bpm=>bpm<attempt.bpm).map(bpm=>{const option=document.createElement('option');option.value=String(bpm);option.textContent=`${bpm} BPM`;return option;}));
    tempo.value=String(Math.max(40,attempt.bpm-10));
    this.button('replay').disabled=!this.recordingUrl;
    this.button('demo').disabled=false; this.button('explain').disabled=false;
    this.root.scrollIntoView({block:'center',behavior:'auto'});
    return true;
  }
  reset():void {
    this.generation++;
    this.abort?.abort(); this.abort=null;
    window.clearTimeout(this.requestTimer);
    this.stop();
    this.request=null; this.recordingUrl=null; this.root.hidden=true;
  }
  stop():void {
    this.playbackGeneration++;
    this.options.stop();
    this.replay?.pause(); this.replay=null;
    window.clearTimeout(this.replayTimer);
    this.button('stop').disabled=true;
    if(this.request) this.text('status','Stopped. Nothing was recorded.');
  }
  private async explain():Promise<void> {
    if(!this.request) return;
    this.stop(); this.abort?.abort();
    const request=this.request;
    const abort=new AbortController(); this.abort=abort;
    const generation=++this.generation;
    this.button('explain').disabled=true;
    this.button('demo').disabled=true;
    this.text('answer','Astra is looking at the selected timing measurements…');
    this.element('attribution').hidden=true;
    this.requestTimer=window.setTimeout(()=>abort.abort(),15000);
    try {
      const response=await fetch('/api/mistake-explanation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:abort.signal});
      const payload=await response.json() as {explanation?:unknown;error?:string};
      if(generation!==this.generation) return;
      if(!response.ok) throw new Error(payload.error??'Astra could not explain this hit. Retry explanation.');
      const answer=validateMistakeExplanation(payload.explanation,request);
      if(!answer) throw new Error('The explanation did not match this hit. Retry explanation.');
      this.text('answer',answer.explanation);
      this.text('recipe',DEMO_RECIPES[answer.recipe]);
      this.element<HTMLSelectElement>('tempo').value=String(answer.bpm);
      this.element('attribution').hidden=false;
    } catch(error) {
      if(generation===this.generation) this.text('answer',abort.signal.aborted?'Explanation timed out. Your take is kept; try again.':error instanceof Error?error.message:'Could not get an explanation. Try again.');
    } finally {
      if(generation===this.generation) { window.clearTimeout(this.requestTimer); this.button('explain').disabled=false; this.button('demo').disabled=false; }
    }
  }
  private async demonstrate():Promise<void> {
    if(!this.request) return;
    this.stop();
    const generation=this.playbackGeneration;
    this.button('stop').disabled=false;
    const bpm=Number(this.element<HTMLSelectElement>('tempo').value);
    this.text('status',`Count-in, then two repetitions at ${bpm} BPM. Watch only.`);
    try { await this.options.play(this.request,bpm); if(generation===this.playbackGeneration) this.text('status','Example finished. Replay it or hear your passage.'); }
    catch { if(generation===this.playbackGeneration) this.text('status','Sound could not start. Try the demonstration again.'); }
    finally { if(generation===this.playbackGeneration) this.button('stop').disabled=true; }
  }
  setPlaybackStatus(message:string):void { this.text('status',message); }
  private async playPassage():Promise<void> {
    if(!this.request||!this.recordingUrl) return;
    this.stop();
    const slice=recordingPassage(this.request);
    const player=new Audio(this.recordingUrl); this.replay=player;
    this.button('stop').disabled=false;
    this.text('status','Playing your recorded passage at its original speed.');
    const finish=()=>{if(this.replay===player){this.stop();this.text('status','Your passage finished.');}};
    player.addEventListener('timeupdate',()=>{if(player.currentTime>=slice.endSeconds) finish();});
    player.addEventListener('ended',finish,{once:true});
    player.addEventListener('loadedmetadata',()=>{
      if(this.replay!==player) return;
      player.currentTime=Math.min(slice.startSeconds,Number.isFinite(player.duration)?player.duration:slice.startSeconds);
      this.replayTimer=window.setTimeout(finish,(slice.endSeconds-slice.startSeconds)*1000+150);
    },{once:true});
    try { await player.play(); } catch { if(this.replay===player){this.stop();this.text('status','Recording replay is unavailable in this browser.');} }
  }
  private element<T extends HTMLElement=HTMLElement>(suffix:string):T { return this.root.querySelector<T>(`#ai-mistake-${suffix}`)!; }
  private button(suffix:string):HTMLButtonElement { return this.element<HTMLButtonElement>(suffix); }
  private text(suffix:string,value:string):void { this.element(suffix).textContent=value; }
}
