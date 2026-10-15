// Adapted from Koekit probe/saezuri/light-voice.js (2026-10-03-timbres-v2).
// Selected musical timbres only; release is included in each allotted note length.
const timbres={
  piano:{wave:'sine',attack:.006,decay:.8,sustain:.035,ratio:3,depth:.9,modDecay:.18},
  'fm-piano':{wave:'sine',attack:.005,decay:.95,sustain:.055,ratio:3,depth:3.8,modDecay:.35,modSustain:.06},
  soft:{wave:'triangle',attack:.018,decay:.3,sustain:.62,cutoff:5},
};
export const BELL_TIMBRE=Object.freeze({frequencyHz:440,durationSeconds:2.62,ratio:Math.SQRT2,index:5.2,tailIndex:.9,modDecay:.42,ampDecay:.325,attackFrequencyHz:880,attackDurationSeconds:.06,attackGain:.12});

function ownedVoice(context,oscillators,nodes,level,{time,endTime,frequencyHz,onended}){
  let remaining=oscillators.length,cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;for(const node of nodes)node.disconnect();onended?.();};
  const voice={time,endTime,frequencyHz,stop(){
    if(cleaned)return;level.gain.cancelScheduledValues(context.currentTime);level.gain.setValueAtTime(0,context.currentTime);
    for(const oscillator of oscillators){try{oscillator.stop(context.currentTime);}catch{/* Already ended. */}}cleanup();
  }};
  for(const oscillator of oscillators){oscillator.onended=()=>{if(--remaining===0)cleanup();};oscillator.start(time);oscillator.stop(endTime);}
  return voice;
}

export function musicalVoice(context,output,{timbre='piano',frequencyHz,time=context.currentTime,durationSeconds,gain,endFrequencyHz,glideStart=0,glideEnd=0,onended}){
  const preset=timbres[timbre];if(!preset)throw new Error('音色が見つかりません。');
  const carrier=context.createOscillator(),level=context.createGain(),oscillators=[carrier],nodes=[carrier,level];
  carrier.type=preset.wave;carrier.frequency.value=frequencyHz;carrier.frequency.setValueAtTime(frequencyHz,time);
  const pitch=(parameter,ratio=1)=>{if(endFrequencyHz){parameter.setValueAtTime(frequencyHz*ratio,time+glideStart);parameter.exponentialRampToValueAtTime(endFrequencyHz*ratio,time+glideEnd);}};
  pitch(carrier.frequency);let path=carrier;
  if(preset.ratio){
    const modulator=context.createOscillator(),modulation=context.createGain();modulator.type='sine';modulator.frequency.value=frequencyHz*preset.ratio;modulator.frequency.setValueAtTime(frequencyHz*preset.ratio,time);pitch(modulator.frequency,preset.ratio);
    const depth=frequencyHz*preset.depth;modulation.gain.setValueAtTime(0,time);modulation.gain.linearRampToValueAtTime(depth,time+preset.attack);modulation.gain.setTargetAtTime(depth*(preset.modSustain??.025),time+preset.attack,preset.modDecay);
    modulator.connect(modulation);modulation.connect(carrier.frequency);oscillators.push(modulator);nodes.push(modulator,modulation);
  }
  if(preset.cutoff){
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.Q.value=.55;filter.frequency.setValueAtTime(frequencyHz*preset.cutoff,time);filter.frequency.setTargetAtTime(frequencyHz*2.5,time+preset.attack,.15);carrier.connect(filter);path=filter;nodes.push(filter);
  }
  path.connect(level);level.connect(output);
  const endTime=time+durationSeconds,release=Math.min(.12,durationSeconds*.4),off=endTime-release-.005;
  level.gain.setValueAtTime(0,time);level.gain.linearRampToValueAtTime(gain,time+preset.attack);level.gain.setTargetAtTime(gain*preset.sustain,time+preset.attack,preset.decay);
  const held=gain*(preset.sustain+(1-preset.sustain)*Math.exp(-(off-time-preset.attack)/preset.decay));
  level.gain.setValueAtTime(held,off);level.gain.setTargetAtTime(0,off,release/6);level.gain.setValueAtTime(held*Math.exp(-6*(release-.005)/release),endTime-.005);level.gain.linearRampToValueAtTime(0,endTime);
  return ownedVoice(context,oscillators,nodes,level,{time,endTime,frequencyHz,onended});
}

export function bellVoice(context,output,{time=context.currentTime,onended,attack=true}={}){
  const preset=BELL_TIMBRE,carrier=context.createOscillator(),modulator=context.createOscillator(),deviation=context.createGain(),level=context.createGain();
  carrier.type=modulator.type='sine';carrier.frequency.value=preset.frequencyHz;carrier.frequency.setValueAtTime(preset.frequencyHz,time);
  const modulationFrequency=preset.frequencyHz*preset.ratio;modulator.frequency.setValueAtTime(modulationFrequency,time);
  deviation.gain.setValueAtTime(modulationFrequency*preset.index,time);deviation.gain.setTargetAtTime(modulationFrequency*preset.tailIndex,time,preset.modDecay);
  const peak=.2,bodyEnd=.6,tailDecay=.18,fadeStart=2.54,bodyLevel=peak*Math.exp(-(bodyEnd-.003)/preset.ampDecay);
  level.gain.setValueAtTime(0,time);level.gain.linearRampToValueAtTime(peak,time+.003);level.gain.setTargetAtTime(0,time+.003,preset.ampDecay);
  level.gain.setValueAtTime(bodyLevel,time+bodyEnd);level.gain.setTargetAtTime(0,time+bodyEnd,tailDecay);level.gain.setValueAtTime(bodyLevel*Math.exp(-(fadeStart-bodyEnd)/tailDecay),time+fadeStart);level.gain.linearRampToValueAtTime(0,time+2.6);
  modulator.connect(deviation);deviation.connect(carrier.frequency);carrier.connect(level);level.connect(output);
  let remaining=attack?2:1;const ended=()=>{if(--remaining===0)onended?.();};
  const body=ownedVoice(context,[carrier,modulator],[carrier,modulator,deviation,level],level,{time,endTime:time+preset.durationSeconds,frequencyHz:preset.frequencyHz,onended:ended});
  const hit=attack?musicalVoice(context,output,{timbre:'piano',frequencyHz:preset.attackFrequencyHz,time,durationSeconds:preset.attackDurationSeconds,gain:preset.attackGain,onended:ended}):null;
  return {time,endTime:body.endTime,frequencyHz:preset.frequencyHz,stop(){body.stop();hit?.stop();}};
}
