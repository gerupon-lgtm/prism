import test from 'node:test';
import assert from 'node:assert/strict';
import { Chime, MOVEMENT_SOUND } from '../src/ui/audio.js';

function fixture(){
  const chime=new Chime(),voices=[];
  const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),connect(){},disconnect(){},start(at){this.started=true;this.startedAt=at;},stop(at){this.stopAt=at;if(at===undefined){this.stopped=true;this.onended?.();}}};voices.push(voice);return voice;}};
  chime.output={};chime.muted=false;return {chime,voices};
}
test('移動音は粒数に応じて増えず、待機・一時停止・消音で予約分も止まる',()=>{
  const {chime,voices}=fixture();chime.motion(true);chime.motion(true);assert.equal(voices.length,1);assert(voices[0].started);
  chime.motion(false);assert(voices[0].stopped);chime.motion(true);assert.equal(voices.length,2);chime.stop();assert(voices[1].stopped);
  chime.motion(true);chime.mute();assert(voices[2].stopped);chime.motion(true);assert.equal(voices.length,3);
});

test('描画間隔に依存せず0.1秒ごとの短音を予約し、遅れた音をまとめて鳴らさない',()=>{
  const {chime,voices}=fixture();
  for(let frame=0;frame<20;frame++){chime.context.currentTime=frame/60;chime.motion(true);}
  assert.equal(voices.length,4);
  for(let i=0;i<voices.length;i++){
    assert(Math.abs(voices[i].startedAt-i*.1)<1e-9);assert(voices[i].stopAt-voices[i].startedAt<.05);assert.equal(voices[i].frequency.value,330);
  }
  chime.context.currentTime=2;chime.motion(true);assert.equal(voices.length,5);assert.equal(voices[4].startedAt,2);
  chime.motion(false);assert(voices.every(voice=>voice.stopped));assert.equal(chime.nextMovementAt,null);
  assert.equal(MOVEMENT_SOUND.intervalSeconds,.1);
  const pending=fixture();pending.chime.motion(true);pending.chime.context.currentTime=.06;pending.chime.motion(true);
  assert.equal(pending.voices.length,2);assert.equal(pending.voices[1].startedAt,.1);
  pending.chime.motion(false);assert(pending.voices.every(voice=>voice.stopped));assert.equal(pending.chime.movement.size,0);
});
test('鐘の発音前に移動音を止め、余韻の間は再開せず、停止後も抑制を持ち越さない',()=>{
  const {chime,voices}=fixture();chime.motion(true);chime.strike();assert(voices[0].stopped);assert.equal(voices.length,5);
  chime.context.currentTime=2.5;chime.motion(true);assert.equal(voices.length,5);
  chime.context.currentTime=2.63;chime.motion(true);assert.equal(voices.length,6);chime.stop();assert(voices[5].stopped);
  chime.context.currentTime=0;chime.motion(true);assert.equal(voices.length,7);
});
test('重なる到着は最後の鐘の余韻まで移動音を抑え、操作音は消音中に発音しない',()=>{
  const {chime,voices}=fixture();chime.strike();chime.context.currentTime=1;chime.strike();chime.context.currentTime=2.7;chime.motion(true);assert.equal(voices.length,8);
  chime.context.currentTime=3.63;chime.motion(true);assert.equal(voices.length,9);chime.tap();assert.equal(voices.length,10);chime.mute();chime.tap();assert.equal(voices.length,10);
});
test('鐘は基本音と1オクターブ上を同時に混ぜ、余韻の長さを変えない',()=>{
  const {chime,voices}=fixture();chime.context.currentTime=5;chime.strike();
  const base=voices.find(voice=>voice.frequency.value===174.6),upper=voices.find(voice=>voice.frequency.value===349.2);
  assert(base&&upper);assert.equal(base.startedAt,5);assert.equal(upper.startedAt,base.startedAt);assert.equal(upper.stopAt,base.stopAt);assert.equal(chime.bellUntil,7.62);
});
