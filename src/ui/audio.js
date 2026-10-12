// One low bell strike per arrival. Partials sound together, never as a phrase.
export class Chime {
  constructor() { this.muted = true; this.context = null; this.voices = new Set(); }
  async enable() {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) throw new Error('このブラウザでは音を開始できません。到着は画面と記録で確認できます。');
    this.context ??= new Audio();
    if(!this.output){this.output=this.context.createDynamicsCompressor();this.output.connect(this.context.destination);}
    await this.context.resume(); this.muted = false;
  }
  mute() { this.muted = true; this.stop(); }
  strike() {
    if (this.muted || !this.context) return;
    const at = this.context.currentTime;
    for (const [ratio,volume,decay] of [[1,0.12,2.6],[2.76,0.035,1.6],[4.1,0.016,0.9]]) {
      const oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine'; oscillator.frequency.value=174.6*ratio;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+0.006);gain.gain.exponentialRampToValueAtTime(0.0001,at+decay);
      oscillator.connect(gain);gain.connect(this.output); this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+decay+0.02);
    }
  }
  stop() { for (const voice of this.voices) { try {voice.stop();} catch { /* Already stopped. */ } } this.voices.clear(); }
}
