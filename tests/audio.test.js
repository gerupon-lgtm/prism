import test from 'node:test';
import assert from 'node:assert/strict';
import {Chime,BELL_SOUND,DEFAULT_EFFECT_VOLUME} from '../src/ui/audio.js';

function fixture(){
  const chime=new Chime(),voices=[],sources=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({kind:'set',value,at});},setTargetAtTime(value,at,decay){this.events.push({kind:'target',value,at,decay});},linearRampToValueAtTime(value,at){this.events.push({kind:'linear',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({kind:'exponential',value,at});},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,sampleRate:48000,createBuffer:(channels,length)=>({getChannelData:()=>new Float32Array(length)}),createConvolver:()=>({connect(){},disconnect(){}}),createBufferSource:()=>{const source={connect(){},disconnect(){this.disconnected=true;},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at<=chime.context.currentTime){this.stopped=true;this.onended?.();}}};sources.push(source);return source;},createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:parameter(),Q:{value:0},connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),detune:parameter(),connect(){},disconnect(){this.disconnected=true;},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at===undefined||at<=chime.context.currentTime){this.stopped=true;this.onended?.();}}};voices.push(voice);return voice;}};
  chime.output={};return {chime,voices,sources,notes:()=>[...chime.voices].filter(v=>v.frequencyHz!==undefined)};
}

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
  let count=0;const master={gain:{value:0},connect(){count++;}},context={state:'running',destination:{},createDynamicsCompressor:()=>({connect(){count++;}}),createGain:()=>master,resume:async()=>{}};
  const original=globalThis.window;globalThis.window={AudioContext:class{constructor(){return context;}}};
  try{const chime=new Chime();assert.equal(chime.muted,false);assert.equal(chime.context,null);assert.equal(DEFAULT_EFFECT_VOLUME,.7);await chime.enable();assert.equal(master.gain.value,.7);assert.equal(count,2);chime.mute();await chime.enable();assert.equal(count,2);assert.equal(master.gain.value,.7);}finally{globalThis.window=original;}
});

test('音の準備中に消音を選んでも、準備完了で音ありへ戻さない',async()=>{
  let resume;const original=globalThis.window;globalThis.window={AudioContext:class{constructor(){this.state='suspended';this.destination={};}createDynamicsCompressor(){return {connect(){}};}createGain(){return {gain:{},connect(){}};}resume(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});}}};
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

test('未達成3音は最後の鐘から1.5秒空け、3秒待機内に終わる',()=>{
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
