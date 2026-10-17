const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
exports.checkSelectedAudio=async(page,label,{check,pending})=>{
 const root=path.resolve(__dirname,'..'),trial=path.join(__dirname,'音の候補-20261017');
 const url=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
 const old=file=>execFileSync('git',['show','eb0c2039acc61e5440f1203fe8b0e5e8978e7230:'+file],{cwd:root,encoding:'utf8'});
 const baselineVoices=url(old('src/ui/voices.js')),baselineAudio=url(old('src/ui/audio.js').replace("'./voices.js'",JSON.stringify(baselineVoices)));
 const engine=url(fs.readFileSync(path.join(trial,'light-voice.js'),'utf8')),{CANDIDATES}=await import(pathToFileURL(path.join(trial,'catalog.js')));
 const {CANDIDATES:second}=await import(pathToFileURL(path.join(__dirname,'音の候補-20261017-2/catalog.js')));
 const items=[...CANDIDATES.filter(item=>['C1','N2','T2','W2','R2'].includes(item.id)),...second.filter(item=>item.id==='F4')];
 const data=await page.evaluate(async({engine,baselineAudio,items})=>{
  if(typeof OfflineAudioContext!=='function')return null;
  const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src)),{Chime:OldChime}=await import(baselineAudio),{createLightVoice}=await import(engine);
  const {SOUND_CUES}=await import(new URL('./sound-cues.js',document.querySelector('script[type=module]').src));
  async function render(rate,method,{reference=null,context=false,legacy=false}={}){
   const ctx=new OfflineAudioContext(1,3*rate,rate),output=ctx.createDynamicsCompressor(),master=ctx.createGain();master.gain.value=.7;output.connect(master);master.connect(ctx.destination);
   const chime=new (legacy?OldChime:Chime)();chime.output=output;
   const shift=['tap','wire','relay'].includes(method) ? .06 : 0;
   chime.context={state:'running',sampleRate:rate,get currentTime(){return ctx.currentTime+shift;},createBuffer:(...args)=>ctx.createBuffer(...args),createBufferSource:()=>ctx.createBufferSource(),createConvolver:()=>ctx.createConvolver(),createGain:()=>ctx.createGain(),createOscillator:()=>ctx.createOscillator(),createBiquadFilter:()=>ctx.createBiquadFilter()};
   if(context)chime.strike();
   if(reference){const start=['clear','perfect'].includes(method)?.7:method==='failure'?(context?1.5:.42):.06;for(const note of reference.notes)createLightVoice(ctx,output,{midi:note.midi,time:start+note.at,duration:note.duration,instrument:note.instrument,gain:note.gain,velocity:70,...(['tap','wire','relay'].includes(method)?{releaseSeconds:.045}:{})});}
   else if(method==='perfect')chime.cue(SOUND_CUES.perfect,.7);else chime[method]();
   return (await ctx.startRendering()).getChannelData(0);
  }
  const difference=(a,b)=>{let max=0,sum=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum+=d*d;}return {maxDifference:max,rmsDifference:Math.sqrt(sum/a.length)};};
  const selected=[],unchanged=[];
  for(const rate of [48000,44100]){
   for(const item of items){const method={C1:'clear',N2:'failure',T2:'tap',W2:'wire',F4:'perfect',R2:'relay'}[item.id];for(const context of ['clear','failure','perfect'].includes(method)?[false,true]:[false])selected.push({id:item.id,rate,context,...difference(await render(rate,method,{context}),await render(rate,method,{reference:item,context}))});}
   for(const method of ['strike'])unchanged.push({method,rate,...difference(await render(rate,method),await render(rate,method,{legacy:true}))});
  }
  return {selected,unchanged};
 },{engine,baselineAudio,items});
 if(!data){pending.push({label,reason:'OfflineAudioContext unavailable; selected-sound matching and device listening remain pending.'});return;}
 for(const item of items){const rows=data.selected.filter(row=>row.id===item.id);assert(rows.every(row=>row.maxDifference<1e-6),item.id+' matches the selected audition signal: '+JSON.stringify(rows));check(label+' '+item.id+(item.id==='F4'?' dry music':'')+' matches its audition at 48kHz and 44.1kHz',{rows});}
 for(const method of ['strike']){const rows=data.unchanged.filter(row=>row.method===method);assert(rows.every(row=>row.maxDifference<1e-7),method+' unchanged: '+JSON.stringify(rows));check(label+' '+method+' retains the previous audio signal',{rows});}
};
