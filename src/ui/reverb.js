// Only the perfect-score fanfare enters this bus; other effects stay dry.
export const FANFARE_REVERB=Object.freeze({wet:.32,impulseSeconds:.55,preDelaySeconds:.018,fadeStartSeconds:2.46,fadeEndSeconds:2.62,endSeconds:2.64});
const impulses=new WeakMap();
function impulse(context){
  if(impulses.has(context))return impulses.get(context);
  const rate=context.sampleRate,buffer=context.createBuffer(2,Math.ceil(rate*FANFARE_REVERB.impulseSeconds),rate);
  for(let channel=0;channel<2;channel++){
    const data=buffer.getChannelData(channel);let seed=0x1234abcd+channel;
    for(let i=Math.ceil(rate*FANFARE_REVERB.preDelaySeconds);i<data.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      data[i]=(seed/2147483648-1)*.025*Math.exp(-6*i/data.length);
    }
    for(const [seconds,gain] of [[.023,.6],[.041,.36],[.067,.24],[.097,.15]])data[Math.round((seconds+channel*.003)*rate)]+=gain;
  }
  impulses.set(context,buffer);return buffer;
}

export function fanfareReverb(context,output,{time=context.currentTime,onended}={}){
  const preset=FANFARE_REVERB,input=context.createGain(),convolver=context.createConvolver(),filter=context.createBiquadFilter(),wet=context.createGain();
  convolver.normalize=false;convolver.buffer=impulse(context);filter.type='lowpass';filter.frequency.value=4200;filter.Q.value=.55;
  input.connect(output);input.connect(convolver);convolver.connect(filter);filter.connect(wet);wet.connect(output);
  wet.gain.setValueAtTime(preset.wet,time);wet.gain.setValueAtTime(preset.wet,time+preset.fadeStartSeconds);wet.gain.linearRampToValueAtTime(0,time+preset.fadeEndSeconds);
  // A silent audio-clock source owns the tail, including during offline rendering.
  // Its ended event releases the graph; no wall-clock timer or continuing loop remains.
  const lifetime=context.createBufferSource();lifetime.buffer=context.createBuffer(1,1,context.sampleRate);lifetime.loop=true;lifetime.connect(wet);
  const nodes=[input,convolver,filter,wet,lifetime];let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;for(const node of nodes)node.disconnect();onended?.();};
  const effect={input,time,endTime:time+preset.endSeconds,stop(){
    if(cleaned)return;wet.gain.cancelScheduledValues(context.currentTime);wet.gain.setValueAtTime(0,context.currentTime);lifetime.stop(context.currentTime);cleanup();
  }};
  lifetime.onended=cleanup;lifetime.start(time);lifetime.stop(effect.endTime);return effect;
}
