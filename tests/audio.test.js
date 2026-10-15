import test from 'node:test';
import assert from 'node:assert/strict';
import {Chime,RELAY_SOUND,WIRING_SOUND,BELL_SOUND,RESULT_BASE_FREQUENCY_HZ,DEFAULT_EFFECT_VOLUME} from '../src/ui/audio.js';

function fixture(){
  const chime=new Chime(),voices=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({kind:'set',value,at});},setTargetAtTime(value,at,decay){this.events.push({kind:'target',value,at,decay});},linearRampToValueAtTime(value,at){this.events.push({kind:'linear',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({kind:'exponential',value,at});},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:parameter(),Q:{value:0},connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),connect(){},disconnect(){this.disconnected=true;},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at===undefined||at<=chime.context.currentTime){this.stopped=true;this.onended?.();}}};voices.push(voice);return voice;}};
  chime.output={};return {chime,voices,notes:()=>[...chime.voices]};
}

test('結線音は短いエレピ1音で、停止・消音・鐘の余韻では重ならない',()=>{
  const {chime,voices,notes}=fixture();chime.wire();assert.equal(notes().length,1);assert.equal(voices.length,2);
  assert.equal(notes()[0].frequencyHz,WIRING_SOUND.frequencyHz);assert(Math.abs(notes()[0].endTime-.11)<1e-9);assert(voices[0].frequency.events.some(e=>e.value===WIRING_SOUND.endFrequencyHz));
  chime.stop();assert(voices.every(v=>v.stopped));assert.equal(chime.wireVoices.size,0);
  chime.wire();const wire=voices.slice(-2);chime.strike();assert(wire.every(v=>v.stopped));const count=voices.length;chime.wire();assert.equal(voices.length,count);
  chime.context.currentTime=3;chime.wire();assert.equal(voices.length,count+2);chime.mute();assert(voices.slice(-2).every(v=>v.stopped));chime.wire();assert.equal(voices.length,count+2);
  chime.muted=false;chime.context.state='suspended';chime.wire();assert.equal(voices.length,count+2);
});

test('中継点は到着1回につき短いエレピ1音を鳴らし、時間だけでは繰り返さない',()=>{
  const {chime,voices,notes}=fixture();chime.relay();assert.equal(notes().length,1);assert.equal(voices.length,2);
  assert.equal(notes()[0].frequencyHz,RELAY_SOUND.frequencyHz);assert(voices[0].frequency.events.some(e=>e.value===880));assert(Math.abs(notes()[0].endTime-.2)<1e-9);
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
  chime.context.currentTime=3.63;chime.relay();assert.equal(voices.length,count+2);chime.tap();assert.equal(voices.length,count+3);chime.mute();chime.tap();assert.equal(voices.length,count+3);
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

test('通常クリアのエレピ4音は鐘の選択後も従来の音程と時刻を保つ',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.strike();const bellUntil=chime.bellUntil;chime.clear();
  assert.equal(notes().length,5);assert.equal(chime.bellUntil,bellUntil);assert(Math.abs(RESULT_BASE_FREQUENCY_HZ-523.22)<.04);assert.equal(BELL_SOUND.frequencyHz,440);
  notes().slice(1).forEach((voice,index)=>{assert.equal(voice.frequencyHz,RESULT_BASE_FREQUENCY_HZ*[1,1.25,1.5,2][index]);assert.equal(voice.time,5+[.42,.58,.74,.98][index]);assert(Math.abs(voice.endTime-voice.time-.64)<1e-9);});
  chime.stop();assert(voices.every(v=>v.stopped));assert.equal(chime.voices.size,0);
});

test('満点の明るいFMエレピは8音と3和音で、3秒の待機内に収まる',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.perfect();assert.equal(notes().length,11);assert.equal(voices.length,22);
  const melody=notes().slice(0,8),chord=notes().slice(8);assert.deepEqual(melody.map(v=>v.frequencyHz/RESULT_BASE_FREQUENCY_HZ),[1,1.25,1.5,1.5,2,2.5,2.25,2]);
  assert(melody.every((v,i)=>v.time>=5.4&&(i===0||v.time>melody[i-1].time)));assert.deepEqual(chord.map(v=>v.frequencyHz/RESULT_BASE_FREQUENCY_HZ),[1,1.25,1.5]);assert(chord.every(v=>v.time===melody.at(-1).time));assert(notes().every(v=>v.endTime<8));chime.stop();assert(voices.every(v=>v.stopped));
});

test('満点ジングルは消音・休止中には予約せず、消音で予約済みも止める',()=>{
  const {chime,voices,notes}=fixture();chime.muted=true;chime.perfect();assert.equal(voices.length,0);chime.muted=false;chime.context.state='suspended';chime.perfect();assert.equal(voices.length,0);
  chime.context.state='running';chime.perfect();assert.equal(notes().length,11);chime.mute();assert(voices.every(v=>v.stopped));
});

test('未達成は柔らかい音色の下降2音で、消音・休止・停止を守る',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.failure();assert.equal(notes().length,2);assert(voices.every(v=>v.type==='triangle'));
  assert(notes()[1].frequencyHz<notes()[0].frequencyHz&&notes()[0].frequencyHz<RESULT_BASE_FREQUENCY_HZ);assert(notes().every(v=>v.time>=5.4&&v.endTime<6.2));chime.stop();assert(voices.every(v=>v.stopped));
  chime.muted=true;chime.failure();chime.clear();assert.equal(voices.length,2);chime.muted=false;chime.context.state='suspended';chime.failure();chime.clear();assert.equal(voices.length,2);
  chime.context.state='running';chime.clear();assert.equal(notes().length,4);chime.mute();assert(voices.every(v=>v.stopped));
});

test('未達成2音は最後の鐘から1.5秒空け、3秒待機内に終わる',()=>{
  const {chime,voices,notes}=fixture();chime.context.currentTime=5;chime.strike();chime.failure();assert.equal(notes().length,3);assert.equal(notes()[0].endTime,7.62);
  assert.equal(notes()[1].time,6.5);assert(Math.abs(notes()[2].time-6.78)<1e-9);assert(notes().slice(1).every(v=>v.endTime<8));chime.stop();assert(voices.every(v=>v.stopped));
  const latest=fixture();latest.chime.context.currentTime=5;latest.chime.strike();latest.chime.context.currentTime=5.2;latest.chime.strike();latest.chime.context.currentTime=5.3;latest.chime.failure();assert(Math.abs(latest.notes()[2].time-6.7)<1e-9);assert(latest.notes().slice(2).every(v=>v.endTime<8.3));
});

test('開始前の予約を止めても全発振器を解放し、新しい音を再生できる',()=>{
  const {chime,voices,notes}=fixture();chime.perfect();assert(voices.every(v=>v.startedAt>.4));chime.stop();assert(voices.every(v=>v.stopped&&v.disconnected));assert.equal(notes().length,0);chime.clear();assert.equal(notes().length,4);
});
