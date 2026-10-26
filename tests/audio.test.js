import test from 'node:test';
import assert from 'node:assert/strict';
import {Chime,BELL_SOUND,DEFAULT_EFFECT_VOLUME,BELL_RESUME_TIMEOUT_MS} from '../src/ui/audio.js';
import {PlaybackDiagnostics,readPlaybackStats,playbackStatsDelta,playbackDiagnosticText,audioOutputInfo,loadAudioLatency,saveAudioLatency,latencyFromMilliseconds,AUDIO_LATENCY_STORAGE_KEY} from '../src/ui/playback-diagnostics.js';

function fixture(){
  const chime=new Chime(),voices=[],sources=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({kind:'set',value,at});},setTargetAtTime(value,at,decay){this.events.push({kind:'target',value,at,decay});},linearRampToValueAtTime(value,at){this.events.push({kind:'linear',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({kind:'exponential',value,at});},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,sampleRate:48000,createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)}),createConvolver:()=>({connect(){},disconnect(){}}),createBufferSource:()=>{const source={connect(){},disconnect(){this.disconnected=true;},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at<=chime.context.currentTime){this.stopped=true;this.onended?.();}}};sources.push(source);return source;},createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:parameter(),Q:{value:0},connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),detune:parameter(),connect(){},disconnect(){this.disconnected=true;},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at===undefined||at<=chime.context.currentTime){this.stopped=true;this.onended?.();}}};voices.push(voice);return voice;}};
  chime.output={};return {chime,voices,sources,notes:()=>[...chime.voices].filter(v=>v.frequencyHz!==undefined)};
}

test('採用した複数音程は本体と打音を同比率で変え、長さ・停止・消音を保つ',()=>{
 const {chime,voices,notes}=fixture();
 for(const midi of [72,79,84,77,81,88]){
  const frequencyHz=440*2**((midi-69)/12);chime.strike({frequencyHz});
  assert.equal(notes().at(-1).frequencyHz,frequencyHz);assert.equal(notes().at(-1).endTime,2.62);
  const [carrier,modulator,attack]=[voices.at(-4),voices.at(-3),voices.at(-2)];
  assert.equal(carrier.frequency.events[0].value,frequencyHz);assert.equal(modulator.frequency.events[0].value,frequencyHz*Math.SQRT2);assert.equal(attack.frequency.events[0].value,frequencyHz*2);
 }
 chime.stop();assert(voices.every(v=>v.stopped));const count=voices.length;chime.mute();chime.strike({frequencyHz:880});assert.equal(voices.length,count);
});

test('結線音はW2の高い2音で、停止・消音・鐘の余韻では重ならない',()=>{
  const {chime,voices,notes}=fixture();chime.wire();assert.equal(notes().length,2);assert.equal(voices.length,4);
  assert.equal(notes()[0].frequencyHz,880);assert(Math.abs(notes()[1].frequencyHz-1108.7305239074883)<1e-7);assert.equal(notes()[1].time,.055);assert(Math.abs(notes()[1].endTime-.14)<1e-9);
  chime.stop();assert(voices.every(v=>v.stopped));assert.equal(chime.wireVoices.size,0);
  chime.wire();const wire=voices.slice(-4);chime.strike();assert(wire.every(v=>v.stopped));const count=voices.length;chime.wire();assert.equal(voices.length,count);
  chime.context.currentTime=3;chime.wire();assert.equal(voices.length,count+4);chime.mute();assert(voices.slice(-4).every(v=>v.stopped));chime.wire();assert.equal(voices.length,count+4);
  chime.muted=false;chime.context.state='suspended';chime.wire();assert.equal(voices.length,count+4);
});

test('操作音はT2の澄んだ880Hzで、短い余韻のあと終わる',()=>{
  const {chime,voices,notes}=fixture();chime.tap();assert.equal(notes().length,1);assert.equal(voices.length,2);assert.equal(notes()[0].frequencyHz,880);assert(Math.abs(notes()[0].endTime-.075)<1e-9);chime.mute();assert(voices.every(v=>v.stopped));
});

test('素早い画面切替でも短い操作音を残し、消音と全停止では残さない',()=>{
 const {chime,voices}=fixture();chime.tap();const first=voices.slice();
 chime.context.currentTime=.01;chime.tap();const second=voices.slice(-2);
 chime.stop('dialog',{preserveTap:true});
 assert(first.every(v=>!v.stopped));assert(second.every(v=>!v.stopped));
 assert.equal(chime.tapVoices.size,2);assert.equal(chime.voices.size,2);
 chime.context.currentTime=.02;chime.tap();chime.stop('dialog',{preserveTap:true});
 assert.equal(chime.tapVoices.size,3);chime.mute();assert(voices.every(v=>v.stopped));
 assert.equal(chime.voices.size,0);assert.equal(chime.tapVoices.size,0);
 chime.muted=false;chime.tap();chime.stop('hidden');assert(voices.every(v=>v.stopped));
});

test('自動完了では鐘と結果音を自然終了させ、鐘の余韻中の結線音を抑える',()=>{
 for(const outcome of ['clear','perfect','failure']){
  const {chime,voices,sources}=fixture();chime.strike();chime[outcome]();chime.tap();
  const scheduled=voices.map(voice=>voice.stopAt),bellUntil=chime.bellUntil;
  chime.context.currentTime=1.7;chime.stop('completed',{preserveTail:true,preserveTap:true});
  assert(voices.every(voice=>!voice.stopped));assert(sources.every(source=>!source.stopped));
  assert.deepEqual(voices.map(voice=>voice.stopAt),scheduled);assert.equal(chime.bellUntil,bellUntil);
  const count=voices.length;chime.relay();chime.wire();assert.equal(voices.length,count);
  chime.context.currentTime=2.63;chime.relay();assert(voices.length>count);chime.tap();
  chime.stop('restart',{preserveTail:true,preserveTap:true});assert.equal(chime.bellUntil,0);
  assert.equal(chime.voices.size,1);assert.equal(chime.tapVoices.size,1);
  assert(sources.every(source=>source.stopped));chime.mute();assert(voices.every(voice=>voice.stopped));
 }
});

test('自動完了の余韻保持でも中継音と結線音は止め、手動停止では音を残さない',()=>{
 const {chime,voices}=fixture();chime.relay();chime.wire();const transient=voices.slice();chime.tap();
 chime.stop('completed',{preserveTail:true});assert(transient.every(voice=>voice.stopped));
 assert.equal(chime.relayVoices.size,0);assert.equal(chime.wireVoices.size,0);assert.equal(chime.tapVoices.size,1);
 chime.stop('stopped',{preserveTail:true});assert(voices.every(voice=>voice.stopped));assert.equal(chime.tapVoices.size,0);
 for(const reason of ['muted','hidden','dialog','title','records','settings','restart']){
  chime.strike();chime.perfect();chime.tap();chime.stop(reason,{preserveTail:true});
  assert(voices.every(voice=>voice.stopped));assert.equal(chime.voices.size,0);assert.equal(chime.bellUntil,0);
 }
});

test('自動完了後も音声の自然終了で鐘・結果音・残響の接続を全て解放する',()=>{
 const {chime,voices,sources}=fixture();chime.strike();chime.perfect();chime.tap();
 chime.context.currentTime=1.7;chime.stop('completed',{preserveTail:true,preserveTap:true});
 assert(chime.voices.size>0);for(const voice of voices)voice.onended?.();for(const source of sources)source.onended?.();
 assert.equal(chime.voices.size,0);assert.equal(chime.tapVoices.size,0);
 assert(voices.every(voice=>voice.disconnected));assert(sources.every(source=>source.disconnected));
});

test('中継点は選ばれたR2の光片のきらめきを到着1回につき1音鳴らす',()=>{
  const {chime,voices,notes}=fixture();chime.relay();assert.equal(notes().length,1);assert.equal(voices.length,2);
  assert(Math.abs(notes()[0].frequencyHz-1108.7305239074883)<1e-7);assert(Math.abs(notes()[0].endTime-.105)<1e-9);
  chime.context.currentTime=5;assert.equal(voices.length,2);chime.relay();assert.equal(notes().length,2);assert.equal(notes()[1].time,5);
});

test('中継音は停止・消音で止まり、消音中や一時停止中には鳴らさない',()=>{
  const {chime,voices}=fixture();chime.relay();chime.stop();assert(voices.every(v=>v.stopped));assert.equal(chime.relayVoices.size,0);
  chime.relay();chime.mute();assert(voices.every(v=>v.stopped));const count=voices.length;chime.relay();chime.tap();assert.equal(voices.length,count);
  chime.muted=false;chime.context.state='suspended';chime.relay();assert.equal(voices.length,count);
});

test('鐘の前に中継音を止め、余韻の間は抑制し、停止後へ持ち越さない',()=>{
  const {chime,voices}=fixture();chime.relay();const relay=voices.slice();chime.strike();assert(relay.every(v=>v.stopped));const count=voices.length;
  chime.context.currentTime=2.5;chime.relay();assert.equal(voices.length,count);
  chime.context.currentTime=2.63;chime.relay();assert.equal(voices.length,count+2);chime.stop();assert(voices.every(v=>v.stopped));
  chime.context.currentTime=0;chime.relay();assert.equal(voices.length,count+4);
});

test('中継音の片付けに失敗しても鐘の開始を妨げず、他の中継音も止める',()=>{
  const {chime,notes}=fixture();let stopped=false;
  chime.relayVoices.add({stop(){throw new Error('Synthetic stale relay failure');}});
  chime.relayVoices.add({stop(){stopped=true;}});
  assert.doesNotThrow(()=>chime.strike());
  assert(stopped);assert.equal(notes().length,1);assert.equal(notes()[0].frequencyHz,440);
  assert.equal(chime.relayVoices.size,0);assert.equal(chime.wireVoices.size,0);
  const count=notes().length;chime.relay();assert.equal(notes().length,count);
});

test('鐘は操作音も止め、低優先音の片付けで時計が進んでも最新時刻から鳴らす',()=>{
 const {chime,notes}=fixture();chime.tap();const tap=[...chime.tapVoices];
 chime.relayVoices.add({stop(){chime.context.currentTime=5;}});chime.strike();
 assert.equal(chime.tapVoices.size,0);assert(tap.every(v=>!chime.voices.has(v)));
 assert.equal(notes().at(-1).time,5);assert.equal(chime.bellUntil,7.62);
 const count=notes().length;chime.tap();chime.wire();chime.relay();assert.equal(notes().length,count);
 chime.context.currentTime=7.63;chime.tap();assert.equal(notes().length,count+1);
});

test('効果音のゲートが故障しても切り離し、鐘の専用経路から鳴らす',()=>{
 const {chime,notes}=fixture();let detached=false;
 chime.effectOutput={gain:{cancelScheduledValues(){throw Error('Synthetic effect gate failure');}},disconnect(){detached=true;}};
 assert.doesNotThrow(()=>chime.strike());assert(detached);assert.equal(notes().at(-1).frequencyHz,440);
 assert(chime.priorityStats.cleanupFailures>0);
});

test('休止した出力を再開して鐘を優先し、待機中の中継・操作音と結果音を割り込ませない',async()=>{
 const {chime,notes}=fixture();let resume;chime.context.state='suspended';chime.context.resume=()=>new Promise(resolve=>{resume=resolve;});
 chime.strike({frequencyHz:880});const pending=chime.resumeTask;
 chime.strike({frequencyHz:660});chime.clear();chime.context.state='running';chime.relay();chime.tap();assert.equal(notes().length,0);
 resume();await pending;
 assert.deepEqual(notes().slice(0,2).map(n=>n.frequencyHz),[880,660]);assert.equal(notes().length,8);
 assert(notes().slice(2).every(n=>n.time>=notes()[1].time+.7-1e-9));
 assert.equal(chime.pendingBells.length,0);assert.equal(chime.resumeTimer,null);assert.equal(chime.priorityStats.resumedBells,2);
 chime.stop();
});

test('停止・消音・非表示・別実行は再開待ちの鐘を取り消し、古いPromiseで次を鳴らさない',async()=>{
 for(const reason of ['stopped','muted','hidden','restart','settings','dialog','records','title','paused','error']){
  const {chime,notes}=fixture();let resume;chime.context.state='suspended';chime.context.resume=()=>new Promise(resolve=>{resume=resolve;});chime.strike();const pending=chime.resumeTask;
  if(reason==='muted')chime.mute();else chime.stop(reason);
  chime.context.state='running';resume();await pending;assert.equal(notes().length,0,reason);assert.equal(chime.pendingBells.length,0);assert.equal(chime.resumeTimer,null);
  chime.muted=false;chime.strike();assert.equal(notes().length,1,reason+' permits a fresh bell');chime.stop();
 }
});

test('負荷による自動一時停止は到達済みの鐘だけ自然終了させ、手動停止は止める',()=>{
 const {chime,voices,sources}=fixture();chime.strike();const bell=[...chime.bellVoices];chime.perfect();
 assert.equal(bell.length,1);chime.context.currentTime=.1;chime.stop('load');
 assert(bell.every(v=>chime.voices.has(v)));assert.equal(chime.voices.size,1);assert(sources.every(v=>v.stopped));assert.equal(chime.bellUntil,2.62);
 chime.relay();chime.tap();assert.equal(chime.voices.size,1);
 chime.stop('paused');assert(voices.every(v=>v.stopped));assert.equal(chime.bellVoices.size,0);
});

test('負荷停止中も到達済みの再開待ちの鐘を保持し、結果音は取り消す',async()=>{
 const {chime,notes}=fixture();let resume;chime.context.state='suspended';chime.context.resume=()=>new Promise(resolve=>{resume=resolve;});
 chime.strike();const pending=chime.resumeTask;chime.perfect();chime.stop('load');
 chime.context.state='running';resume();await pending;assert.equal(notes().length,1);assert.equal(chime.bellVoices.size,1);assert.equal(chime.pendingOutcome,null);chime.stop('hidden');assert.equal(chime.bellVoices.size,0);
});

test('自然終了では再開待ちの鐘を保持するが、再開拒否・時間切れでは後から鳴らさない',async()=>{
 const {chime,notes}=fixture();let resume;chime.context.state='suspended';chime.context.resume=()=>new Promise(resolve=>{resume=resolve;});chime.strike();const pending=chime.resumeTask;
 chime.stop('completed',{preserveTail:true});chime.context.state='running';resume();await pending;assert.equal(notes().length,1);chime.stop();
 chime.context.state='suspended';chime.context.resume=()=>Promise.reject(new Error('Synthetic resume refusal'));chime.strike();await chime.resumeTask;
 assert.equal(chime.pendingBells.length,0);assert.equal(chime.priorityStats.expiredBells,1);
 chime.context.resume=()=>new Promise(resolve=>{resume=resolve;});chime.strike();const expired=chime.resumeTask;
 await new Promise(resolve=>setTimeout(resolve,BELL_RESUME_TIMEOUT_MS+30));assert.equal(chime.pendingBells.length,0);assert.equal(chime.priorityStats.expiredBells,2);
 chime.context.state='running';const count=notes().length;resume();await expired;assert.equal(notes().length,count);chime.stop();
});

test('重なる到着は最後の鐘の余韻まで中継音を抑え、操作音は消音中に鳴らさない',()=>{
  const {chime,voices}=fixture();chime.strike();chime.context.currentTime=1;chime.strike();const count=voices.length;
  chime.context.currentTime=2.7;chime.relay();assert.equal(voices.length,count);
  chime.context.currentTime=3.63;chime.relay();assert.equal(voices.length,count+2);chime.tap();assert.equal(voices.length,count+4);chime.mute();chime.tap();assert.equal(voices.length,count+4);
});

test('鐘は440Hzのチャイムに短い打音を重ね、2.62秒以内で終わる',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.strike();
  assert(voices.some(v=>Math.abs(v.frequency.value-440)<.01));assert(voices.some(v=>Math.abs(v.frequency.value-880)<.01&&v.stopAt<5.1));
  assert(voices.every(v=>v.startedAt===5&&v.stopAt<=7.62));assert.equal(chime.bellUntil,7.62);assert.equal(notes().length,1);
  chime.stop();assert(voices.every(v=>v.stopped&&v.disconnected));
});

test('共通初期音量は70%で、再有効化でも増幅経路が重複しない',async()=>{
  const gains=[],compressors=[],node=()=>({gain:{value:0,cancelScheduledValues(){},setValueAtTime(){}},connections:[],connect(target){this.connections.push(target);}}),context={state:'running',destination:{},createDynamicsCompressor:()=>{const n=node();compressors.push(n);return n;},createGain:()=>{const n=node();gains.push(n);return n;},resume:async()=>{}};
  const original=globalThis.window;globalThis.window={AudioContext:class{constructor(){return context;}}};
  try{
   const chime=new Chime();assert.equal(chime.muted,false);assert.equal(chime.context,null);assert.equal(DEFAULT_EFFECT_VOLUME,.7);await chime.enable();
   assert.equal(gains.length,2);assert.equal(compressors.length,2);assert.equal(chime.master.gain.value,.7);
   assert.notEqual(chime.bellOutput,chime.output);assert.deepEqual(chime.bellOutput.connections,[chime.master]);assert.deepEqual(chime.effectOutput.connections,[chime.output]);assert.deepEqual(chime.output.connections,[chime.master]);assert.deepEqual(chime.master.connections,[context.destination]);
   chime.mute();assert.equal(chime.master.gain.value,0);await chime.enable();assert.equal(gains.length,2);assert.equal(compressors.length,2);assert.equal(chime.master.gain.value,.7);
  }finally{globalThis.window=original;}
});

test('音の準備中に消音を選んでも、準備完了で音ありへ戻さない',async()=>{
  let resume;const original=globalThis.window;globalThis.window={AudioContext:class{constructor(){this.state='suspended';this.destination={};}createDynamicsCompressor(){return {connect(){}};}createGain(){return {gain:{cancelScheduledValues(){},setValueAtTime(){}},connect(){}};}resume(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});}}};
  try{const chime=new Chime(),pending=chime.enable();chime.mute();resume();await pending;assert.equal(chime.muted,true);chime.tap();assert.equal(chime.voices.size,0);}finally{globalThis.window=original;}
});

test('音声が休止している間は鐘と打音の予約を残さない',()=>{
  const {chime,voices}=fixture();chime.context.state='suspended';chime.strike();assert.equal(voices.length,0);assert.equal(chime.bellUntil,0);
});

test('通常クリアは選ばれたC1の6音を0.7秒後から鳴らし、鐘を変えない',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.strike();const bellUntil=chime.bellUntil;chime.clear();
  assert.equal(notes().length,7);assert.equal(chime.bellUntil,bellUntil);assert.equal(BELL_SOUND.frequencyHz,440);
  notes().slice(1).forEach((voice,index)=>{assert(Math.abs(voice.frequencyHz-[440,554.3652619537442,659.2551138257398,440,554.3652619537442,880][index])<1e-7);assert(Math.abs(voice.time-[5.7,5.88,6.1,6.37,6.37,6.37][index])<1e-9);assert(voice.endTime<7.1);});
  chime.stop();assert(voices.every(v=>v.stopped));assert.equal(chime.voices.size,0);
});

test('満点はF4のブラス7音とStrings11音を0.7秒後から鳴らす',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.perfect();assert.equal(notes().length,18);assert.equal(voices.length,29);
  const melody=notes().slice(0,7),chords=notes().slice(7);
  assert.deepEqual(melody.map(v=>Math.round(69+12*Math.log2(v.frequencyHz/440))),[69,73,76,81,85,83,81]);
  assert.deepEqual(melody.map(v=>Math.round((v.time-5)*100)),[70,82,94,112,136,150,170]);
  assert.deepEqual(chords.map(v=>Math.round(69+12*Math.log2(v.frequencyHz/440))),[57,61,64,59,68,71,76,57,69,73,76]);
  assert(notes().every(v=>v.endTime<7.41));assert(voices.every(v=>v.type==='sawtooth'));chime.stop();assert(voices.every(v=>v.stopped&&v.disconnected));
});

test('満点ジングルは消音・休止中には予約せず、消音で予約済みも止める',()=>{
  const {chime,voices,notes}=fixture();chime.muted=true;chime.perfect();assert.equal(voices.length,0);chime.muted=false;chime.context.state='suspended';chime.perfect();assert.equal(voices.length,0);
  chime.context.state='running';chime.perfect();assert.equal(notes().length,18);chime.mute();assert(voices.every(v=>v.stopped));
});

test('未達成はN2のエレピ下降3音で、消音・休止・停止を守る',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.failure();assert.equal(notes().length,3);assert.equal(voices.length,6);
  assert(notes()[2].frequencyHz<notes()[1].frequencyHz&&notes()[1].frequencyHz<notes()[0].frequencyHz);assert(notes().every(v=>v.time>=5.4&&v.endTime<6.7));chime.stop();assert(voices.every(v=>v.stopped));
  chime.muted=true;chime.failure();chime.clear();assert.equal(voices.length,6);chime.muted=false;chime.context.state='suspended';chime.failure();chime.clear();assert.equal(voices.length,6);
  chime.context.state='running';chime.clear();assert.equal(notes().length,6);chime.mute();assert(voices.every(v=>v.stopped));
});

test('未達成3音は最後の鐘から1.5秒空け、元の長さで再生する',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.strike();chime.failure();assert.equal(notes().length,4);assert.equal(notes()[0].endTime,7.62);
  assert.equal(notes()[1].time,6.5);assert.equal(notes()[2].time,6.75);assert(Math.abs(notes()[3].time-7.02)<1e-9);assert(notes().slice(1).every(v=>v.endTime<8));chime.stop();assert(voices.every(v=>v.stopped));
  const latest=fixture();latest.chime.context.currentTime=5;latest.chime.strike();latest.chime.context.currentTime=5.2;latest.chime.strike();latest.chime.context.currentTime=5.3;latest.chime.failure();assert(Math.abs(latest.notes()[2].time-6.7)<1e-9);assert(latest.notes().slice(2).every(v=>v.endTime<8.3));
});

test('開始前の予約を止めても全発振器を解放し、新しい音を再生できる',()=>{
  const {chime,voices,notes}=fixture();chime.perfect();assert(voices.every(v=>v.startedAt>.4));chime.stop();assert(voices.every(v=>v.stopped&&v.disconnected));assert.equal(notes().length,0);chime.clear();assert.equal(notes().length,6);
});

test('ファンファーレの残響も2.7秒以内で終了し、停止・消音で即時解放する',()=>{
  const {chime,sources,notes}=fixture();chime.perfect();assert.equal(notes().length,18);assert.equal(chime.voices.size,19);assert.equal(sources.length,1);
  assert(sources[0].stopAt>2.4&&sources[0].stopAt<2.65);chime.stop();assert(sources.every(s=>s.stopped&&s.disconnected));assert.equal(chime.voices.size,0);
  chime.perfect();chime.mute();assert(sources.every(s=>s.stopped&&s.disconnected));assert.equal(chime.voices.size,0);
});

test('再生設定は30msを初期値にし、明示した設定では同じContextを再利用する',async()=>{
  const original=globalThis.window,created=[];
  globalThis.window={AudioContext:class{constructor(options){created.push(options);this.state='running';this.destination={};}createDynamicsCompressor(){return {connect(){}};}createGain(){return {gain:{},connect(){}};}async resume(){}}};
  try{for(const [value,expected] of [[undefined,.03],['playback','playback'],['interactive','interactive'],['invalid',.03],[0,0],[.075,.075]]){const chime=new Chime({latencyHint:value});await chime.enable();await chime.enable();assert.equal(chime.latencyHint,expected);}assert.deepEqual(created,[{latencyHint:.03},{latencyHint:'playback'},{latencyHint:'interactive'},{latencyHint:.03},{latencyHint:0},{latencyHint:.075}]);}finally{globalThis.window=original;}
});

test('音声統計は値の写しを取り、未対応・例外・無効値を0回へ読み替えない',()=>{
  const native={underrunEvents:2,underrunDuration:.02,totalDuration:8},copy=readPlaybackStats({playbackStats:native});native.underrunEvents=9;assert.equal(copy.underrunEvents,2);
  for(const context of [null,{},Object.defineProperty({},'playbackStats',{get(){throw Error('unavailable');}}),{playbackStats:{...native,underrunDuration:NaN}},{playbackStats:{...native,totalDuration:-1}}])assert.equal(readPlaybackStats(context),null);
});

test('音声統計は累積値の差を取り、値が戻った場合と未計測を区別する',()=>{
  const before={underrunEvents:2,underrunDuration:.02,totalDuration:8},after={underrunEvents:3,underrunDuration:.04,totalDuration:12};assert.deepEqual(playbackStatsDelta(before,after),{status:'measured',underrunEvents:1,underrunDuration:.02,totalDuration:4});
  assert.equal(playbackStatsDelta(before,{...after,totalDuration:0}).status,'counter-reset');assert.equal(playbackStatsDelta(null,after).status,'unavailable');assert.equal(playbackStatsDelta(before,{...after,underrunEvents:undefined}).status,'unavailable');
});

test('診断は再生の開始・終了だけで読み、同じ区間を二重開始せず累積値の差を取る',()=>{
  let reads=0;const context={currentTime:1,sampleRate:48000,baseLatency:.02,outputLatency:.1,get playbackStats(){reads++;return {underrunEvents:reads,underrunDuration:reads*.01,totalDuration:reads*5};}},d=new PlaybackDiagnostics();d.begin(context,'Q1');d.begin(context,'Q1');for(let i=0;i<10;i++)d.snapshot();assert.equal(reads,1);context.currentTime=5;d.finish('completed');d.finish();assert.equal(reads,2);const row=d.snapshot().recent[0];assert.equal(row.stats.underrunEvents,1);assert.equal(row.stats.totalDuration,5);assert.equal(row.reason,'completed');assert.equal(row.endedAt,5);
});

test('診断の停止と再開は別区間になり、別Contextの累積値を差し引かない',()=>{
  const d=new PlaybackDiagnostics(),a={playbackStats:{underrunEvents:8,underrunDuration:.1,totalDuration:8}},b={playbackStats:{underrunEvents:0,underrunDuration:0,totalDuration:0}};d.begin(a);d.finish();d.begin(b);b.playbackStats.totalDuration=3;d.finish();assert.equal(d.snapshot().recent[0].stats.totalDuration,3);assert.equal(d.snapshot().recent[0].stats.underrunEvents,0);
});

test('診断は直近8区間だけをメモリに保ち、取得した表示用データの変更は記録を壊さない',()=>{
  const d=new PlaybackDiagnostics();for(let i=0;i<12;i++){d.begin({});d.finish();}const copy=d.snapshot();assert.equal(copy.recent.length,8);assert.equal(copy.recent[0].id,12);copy.recent[0].stats.status='changed';assert.equal(d.snapshot().recent[0].stats.status,'unavailable');
});

test('停止・消音で診断を一度だけ終え、消音中は新しい区間を始めない',()=>{
  const {chime}=fixture();chime.beginPlayback('Q1');chime.mute();chime.beginPlayback('Q1');chime.stop();assert.equal(chime.inspectPlayback().recent.length,1);assert.equal(chime.inspectPlayback().recent[0].reason,'muted');assert.equal(chime.inspectPlayback().active,null);chime.muted=false;chime.beginPlayback('Q1');chime.stop('completed');assert.equal(chime.inspectPlayback().recent.length,2);
});

test('遅延の未対応・取得失敗を0msと表示せず、統計の0回にも限界を併記する',()=>{
  const context=Object.defineProperty({sampleRate:48000},'outputLatency',{get(){throw Error('missing');}});assert.deepEqual(audioOutputInfo(context),{sampleRate:48000,baseLatency:null,outputLatency:null});
  const chime=new Chime(),unknown=playbackDiagnosticText(chime.inspectPlayback());assert.match(unknown,/未計測/);chime.context={currentTime:0,playbackStats:{underrunEvents:0,underrunDuration:0,totalDuration:0}};chime.beginPlayback('Q1');chime.stop();const text=playbackDiagnosticText(chime.inspectPlayback());assert.match(text,/出力不足 0回/);assert.match(text,/0回は音欠けがなかった証明ではありません/);
});

test('遅延の数値はミリ秒から秒へ変換し、空欄・負値・範囲外では保存しない',()=>{
  assert.equal(latencyFromMilliseconds('25'),.025);assert.equal(latencyFromMilliseconds('0'),0);assert.equal(latencyFromMilliseconds('1000'),1);
  for(const value of ['', '-1','1001','NaN','Infinity','abc'])assert.throws(()=>latencyFromMilliseconds(value));
  let writes=0;assert.throws(()=>saveAudioLatency({setItem(){writes++;}},-1));assert.equal(writes,0);
});

test('遅延設定だけを保存・復元し、破損・未知版・保存失敗でも他の記録へ触れない',()=>{
  const data=new Map([['records','retained']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};assert.equal(loadAudioLatency(storage),.03);assert.equal(data.has(AUDIO_LATENCY_STORAGE_KEY),false);
  for(const hint of ['playback','interactive',0,.03,.075,1]){saveAudioLatency(storage,hint);assert.equal(loadAudioLatency(storage),hint);assert.equal(data.get('records'),'retained');}
  for(const raw of ['broken',JSON.stringify({version:2,latencyHint:'interactive'}),JSON.stringify({version:1,latencyHint:4})]){data.set(AUDIO_LATENCY_STORAGE_KEY,raw);assert.equal(loadAudioLatency(storage),.03);assert.equal(data.get(AUDIO_LATENCY_STORAGE_KEY),raw);}
  assert.equal(loadAudioLatency({getItem(){throw Error('blocked');}}),.03);
  assert.throws(()=>saveAudioLatency({setItem(){throw Error('quota');}},'interactive'));
});

test('遅延の変更は古いContextの終了を待ち、次の操作で一つだけ作り直し、消音を保つ',async()=>{
  const original=globalThis.window,created=[];let close;
  globalThis.window={AudioContext:class{constructor(options){created.push(options);this.state='running';this.destination={};}createDynamicsCompressor(){return {connect(){}};}createGain(){return {gain:{},connect(){}};}async resume(){}}};
  try{const chime=new Chime();chime.context={close:()=>new Promise(resolve=>close=resolve)};chime.muted=true;const changing=chime.configureLatency(.05),unlock=chime.unlock();assert.equal(created.length,0);close();await changing;await unlock;assert.deepEqual(created,[{latencyHint:.05}]);assert.equal(chime.muted,true);await chime.configureLatency(.05);assert.equal(created.length,1);}finally{globalThis.window=original;}
});
