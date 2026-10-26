import {BELL_TIMBRE,bellVoice,musicalVoice} from './voices.js';
import {SOUND_CUES} from './sound-cues.js';
import {fanfareReverb} from './reverb.js';
import {PlaybackDiagnostics,playbackLatencyHint,audioOutputInfo} from './playback-diagnostics.js';

export const BELL_SOUND=Object.freeze({frequencyHz:BELL_TIMBRE.frequencyHz,durationSeconds:BELL_TIMBRE.durationSeconds});
export const SUCCESS_JINGLE_DELAY_SECONDS=.7;
// Common effect volume: 0 is silent, 1 is the app's maximum (not device volume).
export const DEFAULT_EFFECT_VOLUME=.7;
export const FAILURE_BELL_DELAY_SECONDS=1.5;
export const BELL_RESUME_TIMEOUT_MS=500;

export class Chime {
  constructor({latencyHint}={}){this.latencyHint=playbackLatencyHint(latencyHint);this.playbackDiagnostics=new PlaybackDiagnostics();this.muted=false;this.context=null;this.voices=new Set();this.bellVoices=new Set();this.tapVoices=new Set();this.relayVoices=new Set();this.wireVoices=new Set();this.bellUntil=0;this.pendingBells=[];this.pendingOutcome=null;this.resumeEpoch=0;this.resumeTask=null;this.resumeTimer=null;this.priorityStats={cleanupFailures:0,resumeAttempts:0,resumedBells:0,expiredBells:0};}
  async enable(){this.muted=false;await this.unlock();}
  async unlock(){
    if(this.reconfiguring)await this.reconfiguring;
    const Audio=window.AudioContext??window.webkitAudioContext;
    if(!Audio)throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context??=new Audio({latencyHint:this.latencyHint});
    if(!this.output){
      this.master=this.context.createGain();this.master.gain.value=this.muted?0:DEFAULT_EFFECT_VOLUME;this.master.connect(this.context.destination);
      // A prism or jingle must never reduce the bell's level through a shared
      // compressor. The adopted bell voice and common 70% volume stay intact.
      this.output=this.context.createDynamicsCompressor();this.output.connect(this.master);
      this.bellOutput=this.context.createDynamicsCompressor();this.bellOutput.connect(this.master);
      // Fixed-level interaction cues must not inherit a compressor's recovery
      // from an earlier press, wire, prism or jingle.
      this.effectOutput=this.context.createGain();this.effectOutput.gain.value=1;this.effectOutput.connect(this.master);
      this.createRelayOutput();
    }
    await this.context.resume();
    this.master.gain.value=this.muted?0:DEFAULT_EFFECT_VOLUME;
  }
  mute(){this.muted=true;this.stop('muted');}
  beginPlayback(label){if(!this.muted)this.playbackDiagnostics.begin(this.context,label);}
  inspectPlayback(){return {latencyHint:this.latencyHint,output:audioOutputInfo(this.context),...this.playbackDiagnostics.snapshot(),bellPriority:{...this.priorityStats,pending:this.pendingBells.length}};}
  async configureLatency(value){
    if(this.reconfiguring)await this.reconfiguring;
    const hint=playbackLatencyHint(value);if(hint===this.latencyHint)return;
    this.stop('settings');const previous=this.context;
    const changing=(async()=>{if(previous)await previous.close();this.context=null;this.output=null;this.bellOutput=null;this.effectOutput=null;this.relayOutput=null;this.master=null;this.latencyHint=hint;})();
    this.reconfiguring=changing;try{await changing;}finally{if(this.reconfiguring===changing)this.reconfiguring=null;}
  }
  musical(timbre,options,family,output=this.output){
    const voice=musicalVoice(this.context,output,{...options,timbre,onended:()=>{this.voices.delete(voice);family?.delete(voice);}});
    this.voices.add(voice);family?.add(voice);
    return voice;
  }
  cue({notes},delay=0,family,output=this.output){
    if(this.muted||!this.context||this.context.state!=='running')return;
    let start=this.context.currentTime+delay;const freshStart=family===this.tapVoices||family===this.wireVoices;
    for(const {midi,offsetSeconds,durationSeconds,volume,timbre,releaseSeconds} of notes){
      const voice=this.musical(timbre,{time:start+offsetSeconds,frequencyHz:440*2**((midi-69)/12),durationSeconds,gain:volume,releaseSeconds,freshStart},family,output);
      if(freshStart&&offsetSeconds===0)start=voice.time;
    }
  }
  tap(){
    if(this.muted||!this.context||this.context.state!=='running'||this.pendingBells.length||this.context.currentTime<this.bellUntil)return;
    this.replaceInteraction(this.tapVoices);
    this.cue(SOUND_CUES.tap,0,this.tapVoices,this.effectOutput??this.output);
  }
  stopVoices(voices,options){for(const voice of [...voices]){try{voice.stop(options);}catch{this.priorityStats.cleanupFailures++;}}}
  replaceInteraction(family){this.stopVoices(family,{fadeSeconds:.002});family.clear();}
  createRelayOutput(){this.relayOutput=this.context.createGain();this.relayOutput.gain.value=1;this.relayOutput.connect(this.output);}
  silenceRelay(){
    const before=this.priorityStats.cleanupFailures;this.stopVoices([...this.relayVoices,...this.wireVoices]);this.relayVoices.clear();this.wireVoices.clear();
    // A broken old prism voice must not leak into later arrivals. Replace only
    // its detached bus; the bell's independent output keeps sounding.
    if(this.priorityStats.cleanupFailures>before&&this.relayOutput){const old=this.relayOutput;this.relayOutput=null;try{old.gain.value=0;}catch{/* Try detaching independently. */}try{old.disconnect();}catch{/* Bell output remains independent. */}}
  }
  gateEffects(){
    if(!this.effectOutput||!this.context)return;
    const now=this.context.currentTime,gain=this.effectOutput.gain;
    try{
      gain.cancelScheduledValues(now);
      if(this.pendingBells.length||now<this.bellUntil){gain.setValueAtTime(0,now);if(!this.pendingBells.length)gain.setValueAtTime(1,this.bellUntil);}
      else gain.setValueAtTime(1,now);
    }catch{
      // Failure of an optional effect bus must not block the independent bell.
      this.priorityStats.cleanupFailures++;try{this.effectOutput.disconnect();}catch{/* Already detached. */}
    }
  }
  wire(){
    if(this.muted||!this.context||this.context.state!=='running'||this.pendingBells.length||this.context.currentTime<this.bellUntil)return;
    this.replaceInteraction(this.wireVoices);
    this.cue(SOUND_CUES.wire,0,this.wireVoices,this.effectOutput??this.output);
  }
  relay(){
    if(this.muted||!this.context||this.context.state!=='running'||this.pendingBells.length)return;
    // Same-time arrivals are filtered by their experiment time at the caller.
    // A later prism may overlap the bell tail, outside the tap/wire gate.
    if(!this.relayOutput)this.createRelayOutput();
    this.cue(SOUND_CUES.relay,0,this.relayVoices,this.relayOutput);
  }
  strike({frequencyHz=BELL_SOUND.frequencyHz}={}){
    if(this.muted||!this.context||this.context.state==='closed')return;
    if(this.context.state!=='running'||this.pendingBells.length){
      if(typeof this.context.resume!=='function')return;
      this.pendingBells.push({frequencyHz,at:performance.now()});this.gateEffects();this.silenceRelay();this.stopVoices(this.tapVoices);this.tapVoices.clear();this.resumeBells();return;
    }
    this.ring(frequencyHz);
  }
  ring(frequencyHz,scheduledTime){
    // Reserve priority before touching any lower-priority voice. Read the audio
    // clock again after cleanup, so cleanup time cannot age the bell's attack.
    this.bellUntil=Math.max(this.bellUntil,this.context.currentTime+BELL_SOUND.durationSeconds);this.gateEffects();
    this.silenceRelay();this.stopVoices(this.tapVoices);this.tapVoices.clear();
    const time=Math.max(this.context.currentTime,scheduledTime??0);this.bellUntil=Math.max(this.bellUntil,time+BELL_SOUND.durationSeconds);this.gateEffects();
    const voice=bellVoice(this.context,this.bellOutput??this.output,{time,frequencyHz,onended:()=>{this.voices.delete(voice);this.bellVoices.delete(voice);}});this.voices.add(voice);this.bellVoices.add(voice);
  }
  cancelPendingBells({expired=false}={}){
    if(expired)this.priorityStats.expiredBells+=this.pendingBells.length;
    if(this.resumeTimer!==null)clearTimeout(this.resumeTimer);
    this.resumeTimer=null;this.resumeEpoch++;this.resumeTask=null;this.pendingBells=[];this.pendingOutcome=null;this.gateEffects();
  }
  resumeBells(){
    if(this.resumeTask||this.resumeTimer!==null)return;
    const context=this.context,epoch=++this.resumeEpoch;this.priorityStats.resumeAttempts++;
    this.resumeTimer=setTimeout(()=>{if(this.resumeEpoch===epoch)this.cancelPendingBells({expired:true});},BELL_RESUME_TIMEOUT_MS);
    let resumed;try{resumed=context.resume();}catch{this.cancelPendingBells({expired:true});return;}
    this.resumeTask=Promise.resolve(resumed).then(()=>{
      if(this.resumeEpoch!==epoch||this.context!==context||this.muted||context.state!=='running')return;
      const now=performance.now(),queued=this.pendingBells.filter(entry=>now-entry.at<=BELL_RESUME_TIMEOUT_MS),outcome=this.pendingOutcome;
      this.priorityStats.expiredBells+=this.pendingBells.length-queued.length;
      this.cancelPendingBells();
      const start=context.currentTime,first=queued[0]?.at;
      for(const entry of queued){this.ring(entry.frequencyHz,start+(entry.at-first)/1000);this.priorityStats.resumedBells++;}
      if(queued.length&&outcome)this[outcome]();
    }).catch(()=>{if(this.resumeEpoch===epoch)this.cancelPendingBells({expired:true});});
  }
  successDelay(){return Math.max(SUCCESS_JINGLE_DELAY_SECONDS,this.bellUntil-BELL_SOUND.durationSeconds+SUCCESS_JINGLE_DELAY_SECONDS-(this.context?.currentTime??0));}
  clear(){if(this.pendingBells.length){this.pendingOutcome='clear';return;}this.cue(SOUND_CUES.clear,this.successDelay());}
  perfect(){
    if(this.pendingBells.length){this.pendingOutcome='perfect';return;}
    if(this.muted||!this.context||this.context.state!=='running')return;
    const delay=this.successDelay(),time=this.context.currentTime+delay-SUCCESS_JINGLE_DELAY_SECONDS;
    const effect=fanfareReverb(this.context,this.output,{time,onended:()=>this.voices.delete(effect)});this.voices.add(effect);
    this.cue(SOUND_CUES.perfect,delay,undefined,effect.input);
  }
  failure(){
    if(this.pendingBells.length){this.pendingOutcome='failure';return;}
    const now=this.context?.currentTime??0,lastBell=this.bellUntil-BELL_SOUND.durationSeconds;
    const delay=Math.max(.42,lastBell+FAILURE_BELL_DELAY_SECONDS-now);
    this.cue(SOUND_CUES.failure,delay);
  }
  stop(reason='stopped',{preserveTap=false,preserveTail=false}={}){
    this.playbackDiagnostics.finish(reason);this.silenceRelay();
    // Returning to editing does not shorten the bell or the outcome cue.
    // Explicit stops, navigation and a fresh playback still silence them.
    if(reason==='completed'&&preserveTail)return;
    // Automatic load protection freezes the picture, not an already-arrived
    // bell. Keep only that bell (including its bounded resume), never a jingle.
    if(reason==='load'){this.pendingOutcome=null;this.stopVoices([...this.voices].filter(voice=>!this.bellVoices.has(voice)));return;}
    this.cancelPendingBells();
    this.bellUntil=0;
    this.gateEffects();if(reason==='muted'&&this.master)this.master.gain.value=0;
    // Navigation may immediately follow another press. Let its 75ms response
    // finish; mute, hidden pages and output replacement still stop everything.
    this.stopVoices([...this.voices].filter(voice=>!preserveTap||!this.tapVoices.has(voice)));
  }
}
