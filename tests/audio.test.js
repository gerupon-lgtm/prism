import test from 'node:test';
import assert from 'node:assert/strict';
import { Chime, RELAY_SOUND, WIRING_SOUND, DEFAULT_EFFECT_VOLUME } from '../src/ui/audio.js';

function fixture(){
  const chime=new Chime(),voices=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({kind:'set',value,at});},linearRampToValueAtTime(value,at){this.events.push({kind:'linear',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({kind:'exponential',value,at});},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),connect(){},disconnect(){},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at===undefined){this.stopped=true;this.onended?.();}}};voices.push(voice);return voice;}};
  chime.output={};chime.muted=false;return {chime,voices};
}

test('結線の確定音は短音1回で、停止・消音・鐘の余韻では重ならない',()=>{
  const {chime,voices}=fixture();chime.wire();assert.equal(voices.length,1);
  assert(voices[0].frequency.events.some(e=>e.value===WIRING_SOUND.frequencyHz));
  assert(Math.abs(voices[0].stopAt-WIRING_SOUND.durationSeconds-.01)<1e-9);
  chime.stop();assert(voices[0].stopped);assert.equal(chime.wireVoices.size,0);
  chime.wire();chime.strike();assert(voices[1].stopped);chime.wire();assert.equal(voices.length,3);
  chime.context.currentTime=3;chime.wire();assert.equal(voices.length,4);
  chime.mute();assert(voices[3].stopped);chime.wire();assert.equal(voices.length,4);
  chime.muted=false;chime.context.state='suspended';chime.wire();assert.equal(voices.length,4);
});
test('中継点への到着通知を短いピコンとして1回鳴らし、時間経過だけでは繰り返さない',()=>{
  const {chime,voices}=fixture();chime.relay();assert.equal(voices.length,1);
  assert.equal(voices[0].frequency.value,RELAY_SOUND.frequencyHz);assert(voices[0].frequency.events.some(e=>e.value===RELAY_SOUND.endFrequencyHz));assert(Math.abs(voices[0].stopAt-.2)<1e-9);
  assert(Math.abs(voices[0].frequency.value-659.26)<.02);assert(voices[0].frequency.events.some(e=>Math.abs(e.value-880)<.02));
  chime.context.currentTime=5;assert.equal(voices.length,1);chime.relay();assert.equal(voices.length,2);assert.equal(voices[1].startedAt,5);
});
test('中継音は停止・消音で止まり、消音中や音の一時停止中には鳴らさない',()=>{
  const {chime,voices}=fixture();chime.relay();chime.stop();assert(voices[0].stopped);assert.equal(chime.relayVoices.size,0);
  chime.relay();chime.mute();assert(voices[1].stopped);chime.relay();chime.tap();assert.equal(voices.length,2);
  chime.muted=false;chime.context.state='suspended';chime.relay();assert.equal(voices.length,2);
});
test('鐘の発音前に中継音を止め、余韻の間は鳴らさず、停止後も抑制を持ち越さない',()=>{
  const {chime,voices}=fixture();chime.relay();chime.strike();assert(voices[0].stopped);assert.equal(voices.length,2);
  chime.context.currentTime=2.5;chime.relay();assert.equal(voices.length,2);
  chime.context.currentTime=2.63;chime.relay();assert.equal(voices.length,3);chime.stop();assert(voices[2].stopped);
  chime.context.currentTime=0;chime.relay();assert.equal(voices.length,4);
});
test('重なる到着は最後の鐘の余韻まで中継音を抑え、操作音は消音中に発音しない',()=>{
  const {chime,voices}=fixture();chime.strike();chime.context.currentTime=1;chime.strike();chime.context.currentTime=2.7;chime.relay();assert.equal(voices.length,2);
  chime.context.currentTime=3.63;chime.relay();assert.equal(voices.length,3);chime.tap();assert.equal(voices.length,4);chime.mute();chime.tap();assert.equal(voices.length,4);
});
test('鐘は上のオクターブだけを鳴らし、余韻の長さを変えない',()=>{
  const {chime,voices}=fixture();chime.context.currentTime=5;chime.strike();
  assert.equal(voices.length,1);assert(Math.abs(voices[0].frequency.value-523.22)<.04);
  assert.equal(voices[0].startedAt,5);assert.equal(voices[0].stopAt,7.62);assert.equal(chime.bellUntil,7.62);
});
test('効果音共通の初期音量は最大の70%で、再有効化でも増幅経路が重複しない',async()=>{
  let count=0;const master={gain:{value:0},connect(){count++;}};
  const context={state:'running',destination:{},createDynamicsCompressor:()=>({connect(){count++;}}),createGain:()=>master,resume:async()=>{}};
  const original=globalThis.window;globalThis.window={AudioContext:class{constructor(){return context;}}};
  try{const chime=new Chime();assert.equal(DEFAULT_EFFECT_VOLUME,.7);await chime.enable();assert.equal(master.gain.value,.7);assert.equal(count,2);chime.mute();await chime.enable();assert.equal(count,2);assert.equal(master.gain.value,.7);}finally{globalThis.window=original;}
});
