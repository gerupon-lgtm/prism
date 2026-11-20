// ROOT NOTES src/content/timbres.js の glass と src/audio/engine.js の単音生成を移植。
// 別の音声エンジンは作らず、PRISMのChimeと停止・消音・音量を共有する。
export const GLASS=Object.freeze({name:'グラスハープ',carrier:'sine',ratio:2,index:.35,indexSustain:.5,modDecay:.4,attack:.09,decay:1.4,sustain:.45,release:.6,gain:.11});
export const VOICE_DURATION=1.3;
export const VOICE_LIFE=VOICE_DURATION+GLASS.release*8;
export const SPIRIT_CUES=Object.freeze([.3,.75,1.2].map((at,i)=>Object.freeze({at,hz:698.46*[1,5/4,3/2][i]*Math.SQRT2})));
const buses=new WeakMap();
function outputFor(chime){
 const ctx=chime.context;if(buses.has(ctx))return buses.get(ctx);
 const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=9000;
 const limiter=ctx.createDynamicsCompressor();
 for(const [name,value] of Object.entries({threshold:-3,knee:0,ratio:20,attack:.002,release:.1}))limiter[name].value=value;
 filter.connect(limiter);limiter.connect(chime.master);buses.set(ctx,filter);return filter;
}
export function spiritVoice(chime,hz,start){
 const ctx=chime.context,output=outputFor(chime),t=GLASS;
 return [hz,hz*2**(5/1200)].map(frequency=>{
  const carrier=ctx.createOscillator(),mod=ctx.createOscillator(),depth=ctx.createGain(),amp=ctx.createGain();
  carrier.type=mod.type='sine';carrier.frequency.setValueAtTime(frequency,start);
  const modHz=frequency*t.ratio,peak=t.gain*.55,end=start+VOICE_LIFE;
  mod.frequency.setValueAtTime(modHz,start);depth.gain.setValueAtTime(modHz*t.index,start);
  depth.gain.setTargetAtTime(modHz*t.index*t.indexSustain,start,t.modDecay);
  mod.connect(depth);depth.connect(carrier.frequency);carrier.connect(amp);amp.connect(output);
  amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(peak,start+t.attack);
  amp.gain.setTargetAtTime(peak*t.sustain,start+t.attack,t.decay);
  amp.gain.setTargetAtTime(0,start+VOICE_DURATION,t.release);
  const voice={kind:'spirit',hz:frequency,time:start,end,stopped:false,stop(){
   if(voice.stopped)return;voice.stopped=true;const now=ctx.currentTime;
   amp.gain.cancelScheduledValues(now);amp.gain.setValueAtTime(amp.gain.value,now);amp.gain.linearRampToValueAtTime(0,now+.05);
   for(const node of [carrier,mod])try{node.stop(now+.06);}catch{/* 終了済み */}
   chime.voices.delete(voice);
  }};
  carrier.onended=()=>{chime.voices.delete(voice);for(const node of [carrier,mod,depth,amp])node.disconnect();};
  chime.voices.add(voice);for(const node of [carrier,mod]){node.start(start);node.stop(end);}return voice;
 });
}
