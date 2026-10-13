import test from 'node:test';
import assert from 'node:assert/strict';
import { Chime, RELAY_SOUND } from '../src/ui/audio.js';

function fixture(){
  const chime=new Chime(),voices=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({kind:'set',value,at});},linearRampToValueAtTime(value,at){this.events.push({kind:'linear',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({kind:'exponential',value,at});},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),connect(){},disconnect(){},start(at){this.startedAt=at;},stop(at){this.stopAt=at;if(at===undefined){this.stopped=true;this.onended?.();}}};voices.push(voice);return voice;}};
  chime.output={};chime.muted=false;return {chime,voices};
}
test('中継点への到着通知を短いピコンとして1回鳴らし、時間経過だけでは繰り返さない',()=>{
  const {chime,voices}=fixture();chime.relay();assert.equal(voices.length,1);
  assert.equal(voices[0].frequency.value,RELAY_SOUND.frequencyHz);assert(voices[0].frequency.events.some(e=>e.value===RELAY_SOUND.endFrequencyHz));assert(Math.abs(voices[0].stopAt-.2)<1e-9);
  chime.context.currentTime=5;assert.equal(voices.length,1);chime.relay();assert.equal(voices.length,2);assert.equal(voices[1].startedAt,5);
});
test('中継音は停止・消音で止まり、消音中や音の一時停止中には鳴らさない',()=>{
  const {chime,voices}=fixture();chime.relay();chime.stop();assert(voices[0].stopped);assert.equal(chime.relayVoices.size,0);
  chime.relay();chime.mute();assert(voices[1].stopped);chime.relay();chime.tap();assert.equal(voices.length,2);
  chime.muted=false;chime.context.state='suspended';chime.relay();assert.equal(voices.length,2);
});
test('鐘の発音前に中継音を止め、余韻の間は鳴らさず、停止後も抑制を持ち越さない',()=>{
  const {chime,voices}=fixture();chime.relay();chime.strike();assert(voices[0].stopped);assert.equal(voices.length,5);
  chime.context.currentTime=2.5;chime.relay();assert.equal(voices.length,5);
  chime.context.currentTime=2.63;chime.relay();assert.equal(voices.length,6);chime.stop();assert(voices[5].stopped);
  chime.context.currentTime=0;chime.relay();assert.equal(voices.length,7);
});
test('重なる到着は最後の鐘の余韻まで中継音を抑え、操作音は消音中に発音しない',()=>{
  const {chime,voices}=fixture();chime.strike();chime.context.currentTime=1;chime.strike();chime.context.currentTime=2.7;chime.relay();assert.equal(voices.length,8);
  chime.context.currentTime=3.63;chime.relay();assert.equal(voices.length,9);chime.tap();assert.equal(voices.length,10);chime.mute();chime.tap();assert.equal(voices.length,10);
});
test('鐘は基本音と1オクターブ上を同時に混ぜ、余韻の長さを変えない',()=>{
  const {chime,voices}=fixture();chime.context.currentTime=5;chime.strike();
  const base=voices.find(voice=>voice.frequency.value===174.6),upper=voices.find(voice=>voice.frequency.value===349.2);
  assert(base&&upper);assert.equal(base.startedAt,5);assert.equal(upper.startedAt,base.startedAt);assert.equal(upper.stopAt,base.stopAt);assert.equal(chime.bellUntil,7.62);
});
