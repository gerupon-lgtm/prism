// Comparison candidates only. Source: Koekit two-op-bell-20261014, v2026.10.14-2.
// Keep the original pitch, FM ratio and modulation indices; fit the game's tail.
export const FM_BELL_TRIAL_VERSION='2026.10.16-1';
export const FM_BELL_DURATION_SECONDS=2.62;
export const FM_BELL_PRESETS=Object.freeze({
  small:Object.freeze({label:'小さなベル・高め',frequency:880,ratio:Math.SQRT2,index:2.8,tailIndex:.65,modDecay:.26,ampDecay:.30}),
  chime:Object.freeze({label:'チャイム・単音',frequency:440,ratio:Math.SQRT2,index:5.2,tailIndex:.9,modDecay:.42,ampDecay:.325}),
  large:Object.freeze({label:'大きな鐘・低め',frequency:146.8323839587,ratio:Math.SQRT2,index:9,tailIndex:1.2,modDecay:.60,ampDecay:.35}),
});

export function scheduleFmBell(context,output,preset,time=context.currentTime+.03){
  const carrier=context.createOscillator(),modulator=context.createOscillator(),deviation=context.createGain(),amplitude=context.createGain();
  const attack=.003,peak=.2,bodyEnd=.6,tailDecay=.18,fadeStart=2.54,silentAt=2.6,end=time+FM_BELL_DURATION_SECONDS;
  carrier.type=modulator.type='sine';carrier.frequency.setValueAtTime(preset.frequency,time);
  const modulationFrequency=preset.frequency*preset.ratio;
  modulator.frequency.setValueAtTime(modulationFrequency,time);
  deviation.gain.setValueAtTime(modulationFrequency*preset.index,time);
  deviation.gain.setTargetAtTime(modulationFrequency*preset.tailIndex,time,preset.modDecay);
  amplitude.gain.setValueAtTime(0,time);amplitude.gain.linearRampToValueAtTime(peak,time+attack);
  amplitude.gain.setTargetAtTime(0,time+attack,preset.ampDecay);
  // Keep the first strike, then make room for result sounds and repeated bells.
  const bodyLevel=peak*Math.exp(-(bodyEnd-attack)/preset.ampDecay);
  amplitude.gain.setValueAtTime(bodyLevel,time+bodyEnd);amplitude.gain.setTargetAtTime(0,time+bodyEnd,tailDecay);
  // Meet the natural decay before a quiet fade, rather than cutting an active tail.
  amplitude.gain.setValueAtTime(bodyLevel*Math.exp(-(fadeStart-bodyEnd)/tailDecay),time+fadeStart);
  amplitude.gain.linearRampToValueAtTime(0,time+silentAt);
  modulator.connect(deviation);deviation.connect(carrier.frequency);carrier.connect(amplitude);amplitude.connect(output);
  const nodes=[carrier,modulator,deviation,amplitude];let ended=0,stopped=false,cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;for(const node of nodes)node.disconnect();};
  for(const oscillator of [carrier,modulator]){oscillator.onended=()=>{if(++ended===2)cleanup();};oscillator.start(time);oscillator.stop(end);}
  return {end,stop(){if(stopped||cleaned)return;stopped=true;amplitude.gain.cancelScheduledValues(context.currentTime);amplitude.gain.setValueAtTime(0,context.currentTime);for(const oscillator of [carrier,modulator]){try{oscillator.stop(context.currentTime);}catch{}}}};
}
