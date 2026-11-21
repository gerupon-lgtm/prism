import {ending as D,endingAsset} from '../content/ending.js';
import {ENDING_TEMPLATE} from './ending-template.js';
import {DEFAULT_EFFECT_VOLUME} from './audio.js';
import {KeepAwake} from './keep-awake.js';

export function createEndingScreen({chime,motion,onToggleSound,version}){
 let view=null;
 return {get active(){return !!view;},open(options={}){this.close();view=createView({chime,motion,onToggleSound,version,...options});},close(){view?.dispose();view=null;},syncSettings(){view?.sync();},inspect(){return view?.inspect()??{active:false};}};
}

function createView({chime,motion,onToggleSound,version,initialId='E1',done=()=>{},exit=()=>{},previous=null}){
 const root=document.createElement('dialog');root.id='ending-screen';root.dataset.storyUi='';root.setAttribute('aria-label','PRISM NOTES エンディング');root.innerHTML=ENDING_TEMPLATE;document.body.append(root);for(const popup of root.querySelectorAll('dialog'))popup.dataset.storyUi='';
 const $=id=>root.querySelector('[data-ending-id="'+id+'"]'),music=$('music');
 root.querySelector('.brand small').textContent='エンディング v'+version;
 let disposed=false,sourceNode=null,metadataCancel=null,musicURL=null,musicDownload=null;
 const nativeMedia=!(window.AudioContext??window.webkitAudioContext);
 const awake=new KeepAwake(),START_WAIT_MS=350;
 let starting=false,startWait=null;
 const playbackVolume=()=>nativeMedia?DEFAULT_EFFECT_VOLUME:1;
 root.addEventListener('cancel',event=>{if(event.target===root){event.preventDefault();exit();}});
 $('exit').addEventListener('click',exit);
 let sound=!chime.muted,reduced=motion.reduced;
 let initialSceneHandled=false,mode='intro',afterIndex=0,ready=false,rendered='',currentWorld=null,frame=0,epoch=0,desiredPlaying=false,volumeJob=null,seekPlaying=false,seeking=false;
 const clock=n=>{n=Math.max(0,Math.floor(n));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');};
 const duration=()=>Number.isFinite(music.duration)?music.duration:D.duration;

 const asset=endingAsset;
 const allArt=new Set(Object.values(D.specs).flatMap(s=>[s.bg,...s.art.map(a=>a.name)]));
 function notice(text=''){$('status').textContent=text;$('status').hidden=!text;}
 function cancelVolume(){if(volumeJob){cancelAnimationFrame(volumeJob.frame);volumeJob.resolve(false);volumeJob=null;}}
 function volumeTo(target,ms){
  cancelVolume();const from=music.volume,start=performance.now();
  return new Promise(resolve=>{const job={resolve,frame:0};volumeJob=job;
   function step(now){if(volumeJob!==job)return;const p=Math.min(1,(now-start)/ms);music.volume=from+(target-from)*(.5-.5*Math.cos(Math.PI*p));if(p<1)job.frame=requestAnimationFrame(step);else{volumeJob=null;resolve(true);}}
   job.frame=requestAnimationFrame(step);
  });
 }
 function cancelStart(){if(starting)notice();starting=false;if(startWait){clearTimeout(startWait.timer);startWait.resolve(false);startWait=null;}}
 function waitForStart(){return new Promise(resolve=>{const job={resolve,timer:setTimeout(()=>{if(startWait!==job)return;startWait=null;resolve(true);},START_WAIT_MS)};startWait=job;});}
 function pauseNow(){epoch++;desiredPlaying=false;cancelStart();awake.stop();cancelVolume();music.pause();music.volume=playbackVolume();cancelAnimationFrame(frame);frame=0;render();}
 async function pauseSoft(){const ticket=++epoch;desiredPlaying=false;cancelStart();awake.stop();await volumeTo(0,90);if(ticket!==epoch)return;music.pause();music.volume=playbackVolume();cancelAnimationFrame(frame);frame=0;render();}
 async function play(){
  if(!ready||starting)return;if(mode!=='song'){mode='song';music.currentTime=0;rendered='';}
  if(music.ended)music.currentTime=0;
  const position=music.currentTime,ticket=++epoch;desiredPlaying=true;starting=true;cancelVolume();music.volume=0;music.muted=!sound;notice('曲を準備しています。');render();
  try{
   const unlocked=nativeMedia?Promise.resolve():chime.unlock();
   if(!nativeMedia&&chime.context&&!sourceNode){sourceNode=chime.context.createMediaElementSource(music);sourceNode.connect(chime.master);}
   music.muted=!sound||(!nativeMedia&&!sourceNode);
   const playing=music.play();await Promise.all([unlocked,playing]);
   if(ticket!==epoch||disposed){if(mode!=='song'||!desiredPlaying||disposed)music.pause();return;}
   if(!nativeMedia&&!sourceNode){sourceNode=chime.context.createMediaElementSource(music);sourceNode.connect(chime.master);music.muted=!sound;}
   // Unlock the media element inside the gesture, then let the audio output and
   // first picture settle silently. Rewind that preparation before the audible
   // start, so neither startup latency nor a fade consumes the opening bell.
   music.pause();music.currentTime=position;
   if(!await waitForStart()||ticket!==epoch||disposed)return;
   // Mobile/PWA audio output may suspend while the silent media preparation is
   // paused. Resume at the audible boundary too, without changing the user's
   // mute choice; resuming only before that pause can leave an ON display silent.
   if(!nativeMedia){await chime.unlock();if(ticket!==epoch||disposed)return;if(chime.context?.state!=='running')throw new Error('Audio output is not running');}
   sound=!chime.muted;music.muted=!sound;
   starting=false;music.volume=playbackVolume();notice();await music.play();
   if(ticket!==epoch||disposed)return;void awake.start();render();tick();}
  catch{if(ticket!==epoch)return;music.pause();cancelStart();awake.stop();cancelVolume();desiredPlaying=false;notice('曲を再生できませんでした。「再生」で試せます。');render();}
 }
 function slide(){return mode==='intro'?D.intro:mode==='after'?D.after[afterIndex]:D.song.findLast(s=>s.at<=music.currentTime+.0001)||D.song[0];}
 function svgFor(effect){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1280 800');svg.classList.add('lightmap');svg.setAttribute('aria-hidden','true');
  const shape=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);svg.append(e);};
  if(!['future','credits'].includes(effect))for(const[x,y,r]of[[90,130,1.5],[220,65,2],[415,150,1],[660,130,1.2],[1050,150,1.8],[1180,68,1]])shape('circle',{cx:x,cy:y,r});
  const ray=d=>shape('path',{d,class:'ray'});
  if(['first','far','complete'].includes(effect))ray('M 210 530 Q 550 210 1060 460');
  if(effect==='return'){ray('M 990 560 C 1160 250 560 100 450 260');ray('M 650 210 Q 420 300 250 520');}
  if(effect==='mirror')ray('M 140 430 L 780 360 L 1130 170');
  if(effect==='water')for(const[cx,cy]of[[420,660],[900,665]])for(let i=0;i<3;i++)shape('ellipse',{cx,cy,rx:70+i*25,ry:11+i*7});
  if(effect==='gate')for(let i=0;i<2;i++)shape('ellipse',{cx:650,cy:390,rx:150+i*12,ry:225+i*12});
  return svg;
 }
 function draw(s){
  const spec=D.specs[s.scene];
  if(currentWorld?.dataset.key===s.scene){currentWorld.classList.toggle('future-revealed',s.id==='E6');return;}
  const old=currentWorld,world=document.createElement('div');world.className='world';world.dataset.key=s.scene;
  const bg=new Image();bg.src=asset(spec.bg);bg.className='backdrop';bg.alt='';world.append(bg,svgFor(spec.effect));
  for(const a of spec.art){const img=new Image();img.src=asset(a.name);img.alt='';img.className='art '+a.cls;img.dataset.art=a.name;img.draggable=false;Object.assign(img.style,{left:a.x+'%',top:a.y+'%',width:a.w+'%',height:a.h+'%'});world.append(img);}
  if(spec.effect==='credits'){
   const names=document.createElement('div');names.className='credit-name';
   names.innerHTML='<strong class="credit-lab">SIKUMI LAB</strong><div class="credit-series"><span>SIKUMI</span><span>NOTES</span><b>01</b></div><div class="credit-title">PRISM NOTES</div>';world.append(names);
  }
  world.classList.toggle('future-revealed',s.id==='E6');
  for(const node of $('scenery').children)if(node!==old)node.remove();
  $('scenery').append(world);currentWorld=world;$('scene').style.setProperty('--backdrop','url("'+asset(spec.bg)+'")');
  if(reduced){world.classList.add('visible');old?.remove();}
  else{requestAnimationFrame(()=>{if(currentWorld!==world)return;world.classList.add('visible');old?.classList.remove('visible');});
   if(old)world.addEventListener('transitionend',e=>{if(e.target===world&&e.propertyName==='opacity')old.remove();},{once:true});}
 }
 function render(){
  if(disposed)return;
  const s=slide(),key=s.id+(s.id==='S13'&&music.currentTime>=180?':bell':'');
  if(key!==rendered){rendered=key;draw(s);$('scene').dataset.scene=s.id;$('scene').setAttribute('aria-label',s.place+'、'+s.title);$('era').textContent=s.place;$('chapter-title').textContent=s.title;
   $('block-position').textContent=mode==='song'?'余韻の向こうへ':s.id==='C1'?'PRISM NOTES':mode==='after'?'長い時の後':'結末 · 42面クリア後';
   $('speaker').textContent=s.speaker||'';$('speaker').hidden=!s.speaker;
   const words=s.id==='S13'&&music.currentTime>=180?s.finalWords:s.words||'';$('narration').textContent=words;$('narration').hidden=!words;
   $('next-story').textContent=s.nextStory||'';$('next-story').hidden=!s.nextStory;
   $('words').classList.toggle('music-citation',!!s.musicCredit);$('words').scrollTop=0;
   for(const button of $('scene-list').querySelectorAll('button[data-scene]')){const active=button.dataset.scene===s.id;button.classList.toggle('current',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');}
  }
  const playing=mode==='song'&&desiredPlaying&&!music.paused;
  $('play').textContent=starting?'準備中':playing?'一時停止':'再生';$('play').disabled=!ready||mode!=='song'||starting;
  $('previous').disabled=(mode==='intro'&&!previous)||!ready;
  $('next').disabled=!ready;$('next').textContent=mode==='intro'?'曲を聴く':mode==='song'?'曲のあとへ':afterIndex===2?'タイトルへ':'つづき';
  $('seek').disabled=!ready||mode!=='song';$('seek').max=duration();$('seek').value=mode==='intro'?0:mode==='after'?duration():music.currentTime;
  $('time').textContent=clock(mode==='intro'?0:mode==='after'?Math.round(duration()):music.currentTime)+' / '+clock(Math.round(duration()));
  $('sound').textContent=sound?'音：あり':'音：なし';$('sound').setAttribute('aria-pressed',String(sound));
  for(const id of ['motion','motion-menu']){$(id).textContent=reduced?'動き：控えめ':'動き：通常';$(id).setAttribute('aria-pressed',String(reduced));}
  $('reader').classList.toggle('reduced',reduced);
 }
 function tick(){cancelAnimationFrame(frame);frame=0;if(mode!=='song'||music.paused||music.ended)return;render();frame=requestAnimationFrame(tick);}
 function manual(index){pauseNow();mode='after';afterIndex=index;rendered='';render();}
 function chooseSong(at){pauseNow();mode='song';music.currentTime=Math.max(0,Math.min(at,duration()-.03));rendered='';render();}
 function intro(){pauseNow();mode='intro';music.currentTime=0;rendered='';render();}
 const groups=[['曲の前',[D.intro]],['曲の中',D.song],['曲のあと',D.after]];
 for(const[label,list]of groups){const heading=document.createElement('h3');heading.textContent=label;$('scene-list').append(heading);
  for(const s of list){const button=document.createElement('button');button.type='button';button.dataset.scene=s.id;
   if(s.at!==undefined){const time=document.createElement('time');time.textContent=clock(s.at);button.append(time);}
   const name=document.createElement('span');name.textContent=s.title;button.append(name);
   button.addEventListener('click',()=>{if(s.at!==undefined)chooseSong(s.at);else if(s.id==='E1')intro();else manual(D.after.indexOf(s));$('scene-menu').close();});$('scene-list').append(button);}
 }
 $('play').addEventListener('click',()=>{if(desiredPlaying&&!music.paused)void pauseSoft();else void play();});
 $('next').addEventListener('click',async()=>{if(mode==='intro')void play();else if(mode==='song'){const ticket=epoch+1;await pauseSoft();if(ticket===epoch)manual(0);}else if(afterIndex<2)manual(afterIndex+1);else done();});
 $('previous').addEventListener('click',()=>{if(mode==='intro'&&previous){previous();return;}if(mode==='after'){if(afterIndex>0)manual(afterIndex-1);else chooseSong(D.song.at(-1).at);}else if(mode==='song'){const i=D.song.indexOf(slide());if(i>0)chooseSong(D.song[i-1].at);else intro();}});
 $('chapters').addEventListener('click',()=>{pauseNow();$('scene-menu').showModal();});
 $('close-menu').addEventListener('click',()=>$('scene-menu').close());
 $('scene-menu').addEventListener('close',()=>$('chapters').focus({preventScroll:true}));
 $('restart').addEventListener('click',()=>{chooseSong(0);$('scene-menu').close();void play();});
 $('sound').addEventListener('click',async()=>{try{await onToggleSound({quiet:true,mediaFallback:nativeMedia});if(disposed)return;sync();if(sound&&desiredPlaying&&!music.paused&&!sourceNode&&!nativeMedia){pauseNow();void play();}}catch{chime.mute();notice('音を開始できませんでした。');sync();}});
 function toggleMotion(){motion.select(motion.reduced?'full':'reduce');sync();}
 $('motion').addEventListener('click',toggleMotion);$('motion-menu').addEventListener('click',toggleMotion);

 $('seek').addEventListener('pointerdown',()=>{seeking=true;seekPlaying=desiredPlaying&&!music.paused;pauseNow();});
 $('seek').addEventListener('input',()=>{const target=Number($('seek').value);if(!seeking){seeking=true;seekPlaying=desiredPlaying&&!music.paused;pauseNow();}music.currentTime=target;rendered='';render();});
 $('seek').addEventListener('change',()=>{seeking=false;if(seekPlaying)void play();seekPlaying=false;});
 $('seek').addEventListener('pointercancel',()=>{seeking=false;seekPlaying=false;});
 music.addEventListener('timeupdate',()=>{if(mode==='song')render();});
 music.addEventListener('seeked',()=>{if(mode==='song')render();});
 music.addEventListener('playing',()=>{if(mode!=='song'||!desiredPlaying){music.pause();return;}if(!starting){void awake.start();tick();}});
 music.addEventListener('pause',()=>awake.stop());
 music.addEventListener('ended',()=>{if(mode==='song')manual(0);});
 music.addEventListener('error',()=>{if(ready){pauseNow();notice('曲を読み込めませんでした。準備をやり直せます。');$('retry').hidden=false;}});
 const hidden=()=>{if(document.hidden)pauseNow();};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pauseNow);
 async function prepare(){
  ready=false;$('retry').hidden=true;notice('絵と曲を準備しています。');render();
  const jobs=[...allArt].map(name=>{const img=new Image();img.src=asset(name);return img.decode();});
  // Load the finite file once through fetch, which also works from the offline
  // cache on WebKit ports whose media loader cannot decode synthetic SW ranges.
  jobs.push((async()=>{
   if(nativeMedia){if(!music.src)music.src=D.music;}
   else if(!musicURL){const controller=new AbortController();musicDownload=controller;const timeout=setTimeout(()=>controller.abort(),60000);
    try{const response=await fetch(D.music,{signal:controller.signal});if(!response.ok)throw new Error('Music unavailable');const blob=await response.blob();if(disposed)return;musicURL=URL.createObjectURL(blob);music.src=musicURL;}
    finally{clearTimeout(timeout);if(musicDownload===controller)musicDownload=null;}}
   await new Promise((resolve,reject)=>{
   const clean=()=>{clearTimeout(timer);music.removeEventListener('loadedmetadata',check);music.removeEventListener('durationchange',check);music.removeEventListener('error',fail);metadataCancel=null;};
   const check=()=>{if(music.readyState>=1&&Number.isFinite(music.duration)&&music.duration>0){clean();resolve();}};
   const fail=()=>{clean();reject(new Error('Music metadata unavailable'));};
   const timer=setTimeout(fail,60000);metadataCancel=fail;
   music.addEventListener('loadedmetadata',check);music.addEventListener('durationchange',check);music.addEventListener('error',fail);
   if(music.readyState>=1)check();else music.load();
   });
  })());
  const results=await Promise.allSettled(jobs);if(disposed)return;
  if(results.some(r=>r.status==='rejected')){notice('絵か曲を読み込めませんでした。準備をやり直せます。');$('retry').hidden=false;render();return;}
  ready=true;notice();render();
  if(!initialSceneHandled){initialSceneHandled=true;const id=initialId,a=D.after.findIndex(s=>s.id===id),song=D.song.find(s=>s.id===id);if(a>=0)manual(a);else if(song)chooseSong(song.at);else if(id==='E2')chooseSong(0);else if(id==='E3')chooseSong(D.song.find(s=>s.id==='S11').at);else if(id==='E4')chooseSong(180);}
 }
 $('retry').addEventListener('click',()=>void prepare());
 music.volume=playbackVolume();music.muted=!sound;
 function sync(){sound=!chime.muted;reduced=motion.reduced;music.muted=!sound||(!nativeMedia&&!sourceNode);render();}
 function inspect(){return {active:!disposed,legacyId:mode==='intro'?'E1':mode==='after'?(slide().id==='C1'?'E6':slide().id):(slide().id==='S11'?'E3':slide().id==='S13'?'E4':'E2'),version,musicVersion:D.musicVersion,mode,scene:slide().id,time:music.currentTime,duration:duration(),paused:music.paused,ready,starting,startWaitMs:START_WAIT_MS,wakeLock:awake.inspect(),sound,reduced,mediaMuted:music.muted,masterGain:chime.master?.gain.value??null,volume:music.volume,effectiveVolume:sound?music.volume*(sourceNode?(chime.master?.gain.value??DEFAULT_EFFECT_VOLUME):nativeMedia?1:DEFAULT_EFFECT_VOLUME):0,sourceConnected:!!sourceNode,outputMode:nativeMedia?'media-element':'shared-audio-context',latencyApplied:!!sourceNode,latencyHint:chime.latencyHint,audioState:chime.context?.state??'uncreated',worlds:$('scenery').children.length};}
 function dispose(){if(disposed)return;disposed=true;epoch++;cancelStart();awake.stop();musicDownload?.abort();metadataCancel?.();cancelVolume();cancelAnimationFrame(frame);music.pause();sourceNode?.disconnect();music.removeAttribute('src');music.load();if(musicURL)URL.revokeObjectURL(musicURL);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pauseNow);if($('scene-menu').open)$('scene-menu').close();if(root.open)root.close();root.remove();}
 root.showModal();render();void prepare();
 return {dispose,sync,inspect};
}
