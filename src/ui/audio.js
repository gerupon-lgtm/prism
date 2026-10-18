import {BELL_TIMBRE,bellVoice,musicalVoice} from './voices.js';
import {SOUND_CUES} from './sound-cues.js';
import {fanfareReverb} from './reverb.js';
import {PlaybackDiagnostics,playbackLatencyHint,audioOutputInfo} from './playback-diagnostics.js';

export const BELL_SOUND=Object.freeze({frequencyHz:BELL_TIMBRE.frequencyHz,durationSeconds:BELL_TIMBRE.durationSeconds});
export const SUCCESS_JINGLE_DELAY_SECONDS=.7;
// Common effect volume: 0 is silent, 1 is the app's maximum (not device volume).
export const DEFAULT_EFFECT_VOLUME=.7;
export const FAILURE_BELL_DELAY_SECONDS=1.5;

export class Chime {
  constructor({latencyHint}={}){this.latencyHint=playbackLatencyHint(latencyHint);this.playbackDiagnostics=new PlaybackDiagnostics();this.muted=false;this.context=null;this.voices=new Set();this.relayVoices=new Set();this.wireVoices=new Set();this.bellUntil=0;}
  async enable(){this.muted=false;await this.unlock();}
  async unlock(){
    if(this.reconfiguring)await this.reconfiguring;
    const Audio=window.AudioContext??window.webkitAudioContext;
    if(!Audio)throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context??=new Audio({latencyHint:this.latencyHint});
    if(!this.output){this.output=this.context.createDynamicsCompressor();const master=this.context.createGain();master.gain.value=DEFAULT_EFFECT_VOLUME;this.output.connect(master);master.connect(this.context.destination);}
    await this.context.resume();
  }
  mute(){this.muted=true;this.stop('muted');}
  beginPlayback(label){if(!this.muted)this.playbackDiagnostics.begin(this.context,label);}
  inspectPlayback(){return {latencyHint:this.latencyHint,output:audioOutputInfo(this.context),...this.playbackDiagnostics.snapshot()};}
  async configureLatency(value){
    if(this.reconfiguring)await this.reconfiguring;
    const hint=playbackLatencyHint(value);if(hint===this.latencyHint)return;
    this.stop('settings');const previous=this.context;
    const changing=(async()=>{if(previous)await previous.close();this.context=null;this.output=null;this.latencyHint=hint;})();
    this.reconfiguring=changing;try{await changing;}finally{if(this.reconfiguring===changing)this.reconfiguring=null;}
  }
  musical(timbre,options,family,output=this.output){
    const voice=musicalVoice(this.context,output,{...options,timbre,onended:()=>{this.voices.delete(voice);family?.delete(voice);}});
    this.voices.add(voice);family?.add(voice);
  }
  cue({notes},delay=0,family,output=this.output){
    if(this.muted||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;
    for(const {midi,offsetSeconds,durationSeconds,volume,timbre,releaseSeconds} of notes)this.musical(timbre,{time:now+delay+offsetSeconds,frequencyHz:440*2**((midi-69)/12),durationSeconds,gain:volume,releaseSeconds},family,output);
  }
  tap(){
    if(this.muted||!this.context||this.context.state!=='running')return;
    this.cue(SOUND_CUES.tap);
  }
  silenceRelay(){for(const voice of [...this.relayVoices,...this.wireVoices])voice.stop();this.relayVoices.clear();this.wireVoices.clear();}
  wire(){
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    this.cue(SOUND_CUES.wire,0,this.wireVoices);
  }
  relay(){
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    this.cue(SOUND_CUES.relay,0,this.relayVoices);
  }
  strike(){
    if(this.muted||!this.context||this.context.state!=='running')return;
    const time=this.context.currentTime;this.silenceRelay();this.bellUntil=Math.max(this.bellUntil,time+BELL_SOUND.durationSeconds);
    const voice=bellVoice(this.context,this.output,{time,onended:()=>this.voices.delete(voice)});this.voices.add(voice);
  }
  clear(){this.cue(SOUND_CUES.clear,SUCCESS_JINGLE_DELAY_SECONDS);}
  perfect(){
    if(this.muted||!this.context||this.context.state!=='running')return;
    const effect=fanfareReverb(this.context,this.output,{onended:()=>this.voices.delete(effect)});this.voices.add(effect);
    this.cue(SOUND_CUES.perfect,SUCCESS_JINGLE_DELAY_SECONDS,undefined,effect.input);
  }
  failure(){
    const now=this.context?.currentTime??0,lastBell=this.bellUntil-BELL_SOUND.durationSeconds;
    const delay=Math.max(.42,lastBell+FAILURE_BELL_DELAY_SECONDS-now);
    this.cue(SOUND_CUES.failure,delay);
  }
  stop(reason='stopped'){this.playbackDiagnostics.finish(reason);this.silenceRelay();this.bellUntil=0;for(const voice of [...this.voices])voice.stop();this.voices.clear();}
}
