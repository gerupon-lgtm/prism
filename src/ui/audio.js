// Keep only the upper octave of the previously mixed bell.
export const BELL_SOUND = Object.freeze({ frequencyHz: 174.6 * 2 ** (7 / 12) * 2, durationSeconds: 2.62 });
// Common effect volume: 0 is silent, 1 is the app's maximum (not device volume).
export const DEFAULT_EFFECT_VOLUME = 0.7;
export const WIRING_SOUND = Object.freeze({frequencyHz:880,endFrequencyHz:1174.66,durationSeconds:0.1});
// Result sounds start after the bell's attack and finish within the end wait.
const note=(ratio,offsetSeconds,durationSeconds,volume)=>Object.freeze({ratio,offsetSeconds,durationSeconds,volume});
export const CLEAR_SOUND = Object.freeze([
  note(1,.42,.62,.075),note(1.25,.58,.62,.075),note(1.5,.74,.62,.075),note(2,.98,.62,.075),
]);
export const PERFECT_SOUND = Object.freeze([
  note(1,.42,.35,.065),note(1.25,.56,.35,.065),note(1.5,.70,.35,.065),note(1.5,.84,.35,.065),
  note(2,1.02,.35,.065),note(2.5,1.20,.35,.065),note(2.25,1.38,.35,.065),note(2,1.60,.65,.065),
  note(1,1.60,.65,.025),note(1.25,1.60,.65,.025),note(1.5,1.60,.65,.025),
]);
export const FAILURE_SOUND = Object.freeze([
  note(.75,.42,.28,.06),note(.625,.70,.28,.06),
]);
// Let the last bell decay before the quiet failure notes; both still end within 3s.
export const FAILURE_BELL_DELAY_SECONDS = 1.5;
// One short notification per prism arrival; no periodic movement sound.
export const RELAY_SOUND = Object.freeze({
  frequencyHz: 659.26,
  endFrequencyHz: 880,
  durationSeconds: 0.18,
});

export class Chime {
  constructor() { this.muted = false; this.context = null; this.voices = new Set();this.relayVoices=new Map();this.wireVoices=new Map();this.bellUntil=0; }
  async enable() {
    this.muted=false;
    await this.unlock();
  }
  async unlock() {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context ??= new Audio();
    if(!this.output){
      this.output=this.context.createDynamicsCompressor();
      const master=this.context.createGain();master.gain.value=DEFAULT_EFFECT_VOLUME;
      this.output.connect(master);master.connect(this.context.destination);
    }
    await this.context.resume();
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
    if (this.muted || !this.context || this.context.state!=='running') return;
    const at = this.context.currentTime;
    this.silenceRelay();this.bellUntil=Math.max(this.bellUntil,at+BELL_SOUND.durationSeconds);
    {
      const oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine'; oscillator.frequency.value=BELL_SOUND.frequencyHz;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.2,at+0.006);gain.gain.exponentialRampToValueAtTime(0.0001,at+2.6);
      oscillator.connect(gain);gain.connect(this.output); this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+BELL_SOUND.durationSeconds);
    }
  }
  clear() { this.sequence(CLEAR_SOUND); }
  perfect() { this.sequence(PERFECT_SOUND); }
  failure() {
    const now=this.context?.currentTime??0,lastBell=this.bellUntil-BELL_SOUND.durationSeconds;
    const delay=Math.max(0,lastBell+FAILURE_BELL_DELAY_SECONDS-now-FAILURE_SOUND[0].offsetSeconds);
    this.sequence(FAILURE_SOUND,delay);
  }
  sequence(notes,delay=0) {
    if(this.muted||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;
    notes.forEach(({ratio,offsetSeconds,durationSeconds,volume})=>{
      const at=now+delay+offsetSeconds,oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine';oscillator.frequency.value=BELL_SOUND.frequencyHz*ratio;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+durationSeconds);
      oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+durationSeconds+.02);
    });
  }
  stop() { this.silenceRelay();this.bellUntil=0;for (const voice of this.voices) { try {voice.stop();} catch { /* Already stopped. */ } } this.voices.clear(); }
}
