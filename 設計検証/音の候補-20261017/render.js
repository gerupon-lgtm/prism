import {createLightVoice,lightVoiceStats} from './light-voice.js';
import {CANDIDATES} from './catalog.js';
import {bellVoice} from '../../src/ui/voices.js';
import {DEFAULT_EFFECT_VOLUME,SUCCESS_JINGLE_DELAY_SECONDS,FAILURE_BELL_DELAY_SECONDS} from '../../src/ui/audio.js';

// Audition only. The game and its accepted chime are not changed.
export async function renderSample(id,withBell=false){
  const item=CANDIDATES.find(candidate=>candidate.id===id);
  if(!item)throw Error('候補が見つかりません。');
  const rate=48000,context=new OfflineAudioContext(1,3*rate,rate),compressor=context.createDynamicsCompressor(),master=context.createGain();
  master.gain.value=DEFAULT_EFFECT_VOLUME;compressor.connect(master);master.connect(context.destination);
  const time=withBell?(item.group==='failure'?FAILURE_BELL_DELAY_SECONDS:SUCCESS_JINGLE_DELAY_SECONDS):.06;
  const bell=withBell?bellVoice(context,compressor,{time:0}):null;
  const shortEffect=['tap','wire','relay'].includes(item.group);
  const voices=item.notes.map(note=>createLightVoice(context,compressor,{midi:note.midi,time:time+note.at,duration:note.duration,instrument:note.instrument,gain:note.gain,velocity:70,...(shortEffect?{releaseSeconds:.045}:{})}));
  const noteEnd=Math.max(...voices.map(voice=>voice.endTime)),end=Math.max(noteEnd,bell?.endTime??0);
  const rendered=await context.startRendering(),length=withBell?3:Math.max(.35,end+.08),pcm=rendered.getChannelData(0).slice(0,Math.ceil(length*rate));
  let peak=0,energy=0,tail=0;for(let i=0;i<pcm.length;i++){const value=Math.abs(pcm[i]);peak=Math.max(peak,value);energy+=value*value;if(i>=(end+.025)*rate)tail=Math.max(tail,value);}
  return {pcm:Array.from(pcm),rate,durationSeconds:pcm.length/rate,start:time,noteEnd,end,peak,rms:Math.sqrt(energy/pcm.length),tail,finite:pcm.every(Number.isFinite),voicesRemaining:lightVoiceStats(context).active};
}
