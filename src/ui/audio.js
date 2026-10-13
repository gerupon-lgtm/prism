// Bell raised by a perfect fifth (7 semitones). Partials sound together.
export const BELL_SOUND = Object.freeze({ frequencyHz: 174.6 * 2 ** (7 / 12) });
// One short notification per prism arrival; no periodic movement sound.
export const RELAY_SOUND = Object.freeze({
  frequencyHz: 659.26,
  endFrequencyHz: 880,
  durationSeconds: 0.18,
});

export class Chime {
  constructor() { this.muted = true; this.context = null; this.voices = new Set();this.relayVoices=new Map();this.bellUntil=0; }
  async enable() {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context ??= new Audio();
    if(!this.output){this.output=this.context.createDynamicsCompressor();this.output.connect(this.context.destination);}
    await this.context.resume(); this.muted = false;
  }
  mute() { this.muted = true; this.stop(); }
  tap() {
    if(this.muted||!this.context||this.context.state!=='running')return;
    const at=this.context.currentTime,oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(640,at);oscillator.frequency.exponentialRampToValueAtTime(480,at+.05);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.004);gain.gain.exponentialRampToValueAtTime(.0001,at+.055);
    oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
    oscillator.start(at);oscillator.stop(at+.06);
  }
  silenceRelay() {
    for(const [oscillator,gain] of this.relayVoices){
      gain.gain.cancelScheduledValues(this.context.currentTime);gain.gain.setValueAtTime(0,this.context.currentTime);
      oscillator.stop();
    }
    this.relayVoices.clear();
  }
  relay() {
    if(this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil)return;
    const at=this.context.currentTime,oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type='sine';oscillator.frequency.value=RELAY_SOUND.frequencyHz;
    oscillator.frequency.setValueAtTime(RELAY_SOUND.frequencyHz,at+.06);oscillator.frequency.exponentialRampToValueAtTime(RELAY_SOUND.endFrequencyHz,at+.08);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+RELAY_SOUND.durationSeconds);
    oscillator.connect(gain);gain.connect(this.output);this.voices.add(oscillator);this.relayVoices.set(oscillator,gain);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);this.relayVoices.delete(oscillator);};oscillator.start(at);oscillator.stop(at+RELAY_SOUND.durationSeconds+.02);
  }
  strike() {
    if (this.muted || !this.context) return;
    const at = this.context.currentTime;
    this.silenceRelay();this.bellUntil=Math.max(this.bellUntil,at+2.62);
    for (const [ratio,volume,decay] of [[1,0.12,2.6],[2,0.05,2.6],[2.76,0.035,1.6],[4.1,0.016,0.9]]) {
      const oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine'; oscillator.frequency.value=BELL_SOUND.frequencyHz*ratio;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+0.006);gain.gain.exponentialRampToValueAtTime(0.0001,at+decay);
      oscillator.connect(gain);gain.connect(this.output); this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+decay+0.02);
    }
  }
  stop() { this.silenceRelay();this.bellUntil=0;for (const voice of this.voices) { try {voice.stop();} catch { /* Already stopped. */ } } this.voices.clear(); }
}
