import {BELL_TIMBRE,bellVoice,musicalVoice} from './voices.js';

export const BELL_SOUND=Object.freeze({frequencyHz:BELL_TIMBRE.frequencyHz,durationSeconds:BELL_TIMBRE.durationSeconds});
// Keep the established melodies independent of the selected bell's pitch.
export const RESULT_BASE_FREQUENCY_HZ=174.6*2**(7/12)*2;
export const RESULT_TIMBRES=Object.freeze({clear:'piano',perfect:'fm-piano',failure:'soft'});
export const SUCCESS_JINGLE_DELAY_SECONDS=.7;
// Common effect volume: 0 is silent, 1 is the app's maximum (not device volume).
export const DEFAULT_EFFECT_VOLUME=.7;
export const WIRING_SOUND=Object.freeze({frequencyHz:880,endFrequencyHz:1174.66,durationSeconds:.1});
const note=(ratio,offsetSeconds,durationSeconds,volume)=>Object.freeze({ratio,offsetSeconds,durationSeconds,volume});
export const CLEAR_SOUND=Object.freeze([
  note(1,.42,.62,.075),note(1.25,.58,.62,.075),note(1.5,.74,.62,.075),note(2,.98,.62,.075),
]);
export const PERFECT_SOUND=Object.freeze([
  note(1,.42,.35,.065),note(1.25,.56,.35,.065),note(1.5,.70,.35,.065),note(1.5,.84,.35,.065),
  note(2,1.02,.35,.065),note(2.5,1.20,.35,.065),note(2.25,1.38,.35,.065),note(2,1.60,.65,.065),
  note(1,1.60,.65,.025),note(1.25,1.60,.65,.025),note(1.5,1.60,.65,.025),
]);
export const FAILURE_SOUND=Object.freeze([note(.75,.42,.28,.06),note(.625,.70,.28,.06)]);
export const FAILURE_BELL_DELAY_SECONDS=1.5;
export const RELAY_SOUND=Object.freeze({frequencyHz:659.26,endFrequencyHz:880,durationSeconds:.18});

export class Chime {
  constructor(){this.muted=false;this.context=null;this.voices=new Set();this.relayVoices=new Set();this.wireVoices=new Set();this.bellUntil=0;}
  async enable(){this.muted=false;await this.unlock();}
  async unlock(){
    const Audio=window.AudioContext??window.webkitAudioContext;
    if(!Audio)throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context??=new Audio();
    if(!this.output){this.output=this.context.createDynamicsCompressor();const master=this.context.createGain();master.gain.value=DEFAULT_EFFECT_VOLUME;this.output.connect(master);master.connect(this.context.destination);}
    await this.context.resume();
  }
  mute(){this.muted=true;this.stop();}
  musical(timbre,options,family){
    const voice=musicalVoice(this.context,this.output,{...options,timbre,onended:()=>{this.voices.delete(voice);family?.delete(voice);}});
    this.voices.add(voice);family?.add(voice);
  }
  tap(){
    if(this.muted||!this.context||this.context.state!=='running')return;
    this.musical('soft',{frequencyHz:640,endFrequencyHz:480,glideEnd:.05,time:this.context.currentTime,durationSeconds:.06,gain:.14});
  }
  silenceRelay(){for(const voice of [...this.relayVoices,...this.wireVoices])voice.stop();this.relayVoices.clear();this.wireVoices.clear();}
  wire(){
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    this.musical('piano',{frequencyHz:WIRING_SOUND.frequencyHz,endFrequencyHz:WIRING_SOUND.endFrequencyHz,glideEnd:.045,time:this.context.currentTime,durationSeconds:WIRING_SOUND.durationSeconds+.01,gain:.12},this.wireVoices);
  }
  relay(){
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    this.musical('piano',{frequencyHz:RELAY_SOUND.frequencyHz,endFrequencyHz:RELAY_SOUND.endFrequencyHz,glideStart:.06,glideEnd:.08,time:this.context.currentTime,durationSeconds:RELAY_SOUND.durationSeconds+.02,gain:.1},this.relayVoices);
  }
  strike(){
    if(this.muted||!this.context||this.context.state!=='running')return;
    const time=this.context.currentTime;this.silenceRelay();this.bellUntil=Math.max(this.bellUntil,time+BELL_SOUND.durationSeconds);
    const voice=bellVoice(this.context,this.output,{time,onended:()=>this.voices.delete(voice)});this.voices.add(voice);
  }
  clear(){this.sequence(CLEAR_SOUND,SUCCESS_JINGLE_DELAY_SECONDS-CLEAR_SOUND[0].offsetSeconds,RESULT_TIMBRES.clear);}
  perfect(){this.sequence(PERFECT_SOUND,SUCCESS_JINGLE_DELAY_SECONDS-PERFECT_SOUND[0].offsetSeconds,RESULT_TIMBRES.perfect);}
  failure(){
    const now=this.context?.currentTime??0,lastBell=this.bellUntil-BELL_SOUND.durationSeconds;
    const delay=Math.max(0,lastBell+FAILURE_BELL_DELAY_SECONDS-now-FAILURE_SOUND[0].offsetSeconds);
    this.sequence(FAILURE_SOUND,delay,RESULT_TIMBRES.failure);
  }
  sequence(notes,delay=0,timbre='piano'){
    if(this.muted||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;
    for(const {ratio,offsetSeconds,durationSeconds,volume} of notes)this.musical(timbre,{time:now+delay+offsetSeconds,frequencyHz:RESULT_BASE_FREQUENCY_HZ*ratio,durationSeconds:durationSeconds+.02,gain:volume});
  }
  stop(){this.silenceRelay();this.bellUntil=0;for(const voice of [...this.voices])voice.stop();this.voices.clear();}
}
