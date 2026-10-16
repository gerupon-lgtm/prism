// Actual synthesized audio from the application's module, not an alternate sound engine.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function wav(samples,rate){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+2*i);return b;}
exports.checkMusicalAudio=async(page,label,{out,check,pending})=>{
 const data=await page.evaluate(async()=>{
  if(typeof OfflineAudioContext!=='function')return null;
  const entry=document.querySelector('script[type=module]').src,{Chime,DEFAULT_EFFECT_VOLUME}=await import(new URL('./audio.js',entry)),{bellVoice}=await import(new URL('./voices.js',entry));
  const rate=48000,rms=(pcm,a,b)=>{let sum=0,n=0;for(let i=Math.round(a*rate);i<Math.round(b*rate);i++){sum+=pcm[i]**2;n++;}return Math.sqrt(sum/n);};
  async function render(method,{bodyOnly=false,bells=0,stopAt=null}={}){
   const ctx=new OfflineAudioContext(1,3*rate,rate),compressor=ctx.createDynamicsCompressor(),master=ctx.createGain();master.gain.value=DEFAULT_EFFECT_VOLUME;compressor.connect(master);master.connect(ctx.destination);
   const chime=new Chime();chime.output=compressor;chime.context={state:'running',get currentTime(){return ctx.currentTime;},createGain:()=>ctx.createGain(),createOscillator:()=>ctx.createOscillator(),createBiquadFilter:()=>ctx.createBiquadFilter()};
   let count=0;const create=ctx.createOscillator.bind(ctx);ctx.createOscillator=()=>{count++;return create();};
   let body;if(bodyOnly)body=bellVoice(chime.context,compressor,{attack:false});else{for(let n=0;n<bells;n++)chime.strike();chime[method]();}
   const scheduled=chime.voices.size;
   let buffer;if(stopAt!==null){const paused=ctx.suspend(stopAt),rendering=ctx.startRendering();await paused;body?.stop();chime.stop();await ctx.resume();buffer=await rendering;}else buffer=await ctx.startRendering();
   const pcm=buffer.getChannelData(0);let peak=0;for(const v of pcm)peak=Math.max(peak,Math.abs(v));
   return {pcm:Array.from(pcm),peak,finite:pcm.every(Number.isFinite),attackRms:rms(pcm,.008,.05),bodyRms:rms(pcm,.15,.3),quietRms:rms(pcm,1.25,1.35),failureRms:rms(pcm,1.54,1.67),tailRms:rms(pcm,2.7,2.95),stoppedRms:stopAt===null?null:rms(pcm,stopAt+.1,2.95),count,scheduled,remaining:chime.voices.size};
  }
  const rows={};for(const method of ['strike','clear','perfect','failure','relay','wire','tap'])rows[method]=await render(method);
  const body=await render('strike',{bodyOnly:true}),tripleFailure=await render('failure',{bells:3}),stopped=await render('strike',{stopAt:.02}),cancelled=await render('perfect',{stopAt:.1});
  return {rate,rows,body,tripleFailure,stopped,cancelled};
 });
 if(!data){pending.push({label,reason:'OfflineAudioContext unavailable in this Windows engine. Actual-device audio remains pending.'});return;}
 for(const [method,row] of Object.entries(data.rows)){assert(row.finite&&row.peak>0&&row.peak<.9&&row.tailRms===0,method+' bounded signal and silent end');assert.equal(row.remaining,0,method+' releases all owned voices naturally');check(label+' '+method+' has a finite non-clipped signal and releases every voice',{peak:row.peak,oscillators:row.count});}
 const bell=data.rows.strike;assert(bell.attackRms>data.body.attackRms*1.05,'The separate strike increases measured onset energy');assert(Math.abs(bell.quietRms-data.body.quietRms)<.00001);assert.equal(bell.count,4);assert.equal(data.body.count,2);check(label+' selected 440Hz chime gains a short separate attack while retaining its late decay',{attackRms:bell.attackRms,bodyOnlyAttackRms:data.body.attackRms,lateRms:bell.quietRms});
 assert.equal(data.rows.clear.count,12);assert.equal(data.rows.perfect.count,22);assert.equal(data.rows.failure.count,6);check(label+' selected C1 and N2 use electric piano while the previous perfect timbre is retained',{clearOscillators:data.rows.clear.count,perfectOscillators:data.rows.perfect.count,failureOscillators:data.rows.failure.count});
 assert(data.tripleFailure.peak<.9&&data.tripleFailure.failureRms>data.tripleFailure.quietRms*4);assert.equal(data.tripleFailure.remaining,0);check(label+' three simultaneous chimes leave room for the failure notes',{quietRms:data.tripleFailure.quietRms,failureRms:data.tripleFailure.failureRms});
 assert.equal(data.stopped.stoppedRms,0);assert.equal(data.cancelled.stoppedRms,0);assert.equal(data.stopped.remaining,0);assert.equal(data.cancelled.remaining,0);check(label+' stop cancels layered bells and future FM notes without residual sound');
 const files=[];for(const [method,row] of Object.entries(data.rows)){if(!['strike','clear','perfect','failure'].includes(method))continue;const bytes=wav(row.pcm,data.rate),name=method+'.wav';fs.writeFileSync(path.join(out,name),bytes);const actual=fs.readFileSync(path.join(out,name)),sha256=crypto.createHash('sha256').update(actual).digest('hex');assert.equal(actual.length,288044);files.push({name,bytes:actual.length,sha256});}
 check(label+' four audition WAVs are generated from the same shipped audio code',{files});
};
