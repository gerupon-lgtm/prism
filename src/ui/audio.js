// Keep only the upper octave of the previously mixed bell.
export const BELL_SOUND = Object.freeze({ frequencyHz: 174.6 * 2 ** (7 / 12) * 2 });
// Common effect volume: 0 is silent, 1 is the app's maximum (not device volume).
export const DEFAULT_EFFECT_VOLUME = 0.7;
export const WIRING_SOUND = Object.freeze({frequencyHz:880,endFrequencyHz:1174.66,durationSeconds:0.1});
// Four soft celesta notes enter after the bell's attack, within the end wait.
export const PERFECT_SOUND = Object.freeze({
  ratios:Object.freeze([1,1.25,1.5,2]),
  offsetsSeconds:Object.freeze([.42,.58,.74,.98]),
  durationSeconds:.62,
});
// One short notification per prism arrival; no periodic movement sound.
export const RELAY_SOUND = Object.freeze({
  frequencyHz: 659.26,
  endFrequencyHz: 880,
  durationSeconds: 0.18,
});

export class Chime {
  constructor() { this.muted = true; this.context = null; this.voices = new Set();this.relayVoices=new Map();this.wireVoices=new Map();this.bellUntil=0; }
  async enable() {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context ??= new Audio();
    if(!this.output){
      this.output=this.context.createDynamicsCompressor();
      const master=this.context.createGain();master.gain.value=DEFAULT_EFFECT_VOLUME;
      this.output.connect(master);master.connect(this.context.destination);
    }
    await this.context.resume(); this.muted = false;
  }
  mute() { this.muted = true; this.stop(); }
  tap() {
    if(this.muted||!this.context||this.context.state!=='running')return;
    const at=this.context.currentTime,oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(640,at);oscillator.frequency.exponentialRampToValueAtTime(480,at+.05);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.14,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+.055);
    oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
    oscillator.start(at);oscillator.stop(at+.06);
  }
  silenceRelay() {
    for(const [oscillator,gain] of [...this.relayVoices,...this.wireVoices]){
      gain.gain.cancelScheduledValues(this.context.currentTime);gain.gain.setValueAtTime(0,this.context.currentTime);
      oscillator.stop();
    }
    this.relayVoices.clear();this.wireVoices.clear();
  }
  wire() {
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    const at=this.context.currentTime,oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(WIRING_SOUND.frequencyHz,at);oscillator.frequency.exponentialRampToValueAtTime(WIRING_SOUND.endFrequencyHz,at+.045);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.12,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+WIRING_SOUND.durationSeconds);
    oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);this.wireVoices.set(oscillator,gain);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);this.wireVoices.delete(oscillator);};oscillator.start(at);oscillator.stop(at+WIRING_SOUND.durationSeconds+.01);
  }
  relay() {
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    const at=this.context.currentTime,oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.value=RELAY_SOUND.frequencyHz;
    oscillator.frequency.setValueAtTime(RELAY_SOUND.frequencyHz,at+.06);oscillator.frequency.exponentialRampToValueAtTime(RELAY_SOUND.endFrequencyHz,at+.08);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.1,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+RELAY_SOUND.durationSeconds);
    oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);this.relayVoices.set(oscillator,gain);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);this.relayVoices.delete(oscillator);};oscillator.start(at);oscillator.stop(at+RELAY_SOUND.durationSeconds+.02);
  }
  strike() {
    if (this.muted || !this.context) return;
    const at = this.context.currentTime;
    this.silenceRelay();this.bellUntil=Math.max(this.bellUntil,at+2.62);
    {
      const oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine'; oscillator.frequency.value=BELL_SOUND.frequencyHz;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.2,at+0.006);gain.gain.exponentialRampToValueAtTime(0.0001,at+2.6);
      oscillator.connect(gain);gain.connect(this.output); this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+2.62);
    }
  }
  perfect() {
    if(this.muted||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;
    PERFECT_SOUND.ratios.forEach((ratio,index)=>{
      const at=now+PERFECT_SOUND.offsetsSeconds[index],oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine';oscillator.frequency.value=BELL_SOUND.frequencyHz*ratio;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.075,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+PERFECT_SOUND.durationSeconds);
      oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+PERFECT_SOUND.durationSeconds+.02);
    });
  }
  stop() { this.silenceRelay();this.bellUntil=0;for (const voice of this.voices) { try {voice.stop();} catch { /* Already stopped. */ } } this.voices.clear(); }
}
