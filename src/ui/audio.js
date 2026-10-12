// One low bell strike per arrival. Partials sound together, never as a phrase.
// Movement audio only; these seconds do not change simulation or record time.
export const MOVEMENT_SOUND = Object.freeze({
  intervalSeconds: 0.1, // Change this value to adjust the repeat interval.
  frequencyHz: 330, // Lower than the previous continuous tone (392 Hz).
  pulseSeconds: 0.035, // Short sound, followed by silence.
});

export class Chime {
  constructor() { this.muted = true; this.context = null; this.voices = new Set();this.movement=new Set();this.nextMovementAt=null;this.bellUntil=0; }
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
  silenceMovement() {
    this.nextMovementAt=null;
    for(const {oscillator,gain} of this.movement){
      gain.gain.cancelScheduledValues(this.context.currentTime);gain.gain.setValueAtTime(0,this.context.currentTime);
      oscillator.stop();
    }
    this.movement.clear();
  }
  motion(moving) {
    if(!moving||this.muted||!this.context||this.context.state!=='running'||this.context.currentTime<this.bellUntil){this.silenceMovement();return;}
    const now=this.context.currentTime,interval=MOVEMENT_SOUND.intervalSeconds;
    this.nextMovementAt??=now;
    // Reserve at most half an interval ahead; stopping cancels reserved sounds.
    const ahead=Math.min(.05,interval/2);
    if(this.nextMovementAt<now-ahead)this.nextMovementAt+=Math.ceil((now-this.nextMovementAt)/interval)*interval;
    if(this.nextMovementAt>now+ahead)return;
    const at=Math.max(now,this.nextMovementAt),duration=Math.min(MOVEMENT_SOUND.pulseSeconds,interval*.6);
    this.nextMovementAt+=interval;
    const oscillator=this.context.createOscillator(),gain=this.context.createGain(),voice={oscillator,gain};
    oscillator.type='sine';oscillator.frequency.value=MOVEMENT_SOUND.frequencyHz;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.012,at+Math.min(.003,duration/4));gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain);gain.connect(this.output);this.movement.add(voice);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.movement.delete(voice);};oscillator.start(at);oscillator.stop(at+duration+.005);
  }
  strike() {
    if (this.muted || !this.context) return;
    const at = this.context.currentTime;
    this.silenceMovement();this.bellUntil=Math.max(this.bellUntil,at+2.62);
    for (const [ratio,volume,decay] of [[1,0.12,2.6],[2,0.05,2.6],[2.76,0.035,1.6],[4.1,0.016,0.9]]) {
      const oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.type='sine'; oscillator.frequency.value=174.6*ratio;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+0.006);gain.gain.exponentialRampToValueAtTime(0.0001,at+decay);
      oscillator.connect(gain);gain.connect(this.output); this.voices.add(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices.delete(oscillator);};
      oscillator.start(at);oscillator.stop(at+decay+0.02);
    }
  }
  stop() { this.silenceMovement();this.bellUntil=0;for (const voice of this.voices) { try {voice.stop();} catch { /* Already stopped. */ } } this.voices.clear(); }
}
