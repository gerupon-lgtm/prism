import test from 'node:test';
import assert from 'node:assert/strict';
import { Chime } from '../src/ui/audio.js';

function fixture(){
  const chime=new Chime(),voices=[];
  const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
  chime.context={state:'running',currentTime:0,createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),createOscillator:()=>{const voice={frequency:parameter(),connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};voices.push(voice);return voice;}};
  chime.output={};chime.muted=false;return {chime,voices};
}
test('移動音は動く粒がある間だけ一つ鳴り、待機・一時停止・消音で止まる',()=>{
  const {chime,voices}=fixture();chime.motion(true);chime.motion(true);assert.equal(voices.length,1);assert(voices[0].started);
  chime.motion(false);assert(voices[0].stopped);chime.motion(true);assert.equal(voices.length,2);chime.stop();assert(voices[1].stopped);
  chime.motion(true);chime.mute();assert(voices[2].stopped);chime.motion(true);assert.equal(voices.length,3);
});
test('鐘の発音前に移動音を止め、余韻の間は再開せず、停止後も抑制を持ち越さない',()=>{
  const {chime,voices}=fixture();chime.motion(true);chime.strike();assert(voices[0].stopped);assert.equal(voices.length,4);
  chime.context.currentTime=2.5;chime.motion(true);assert.equal(voices.length,4);
  chime.context.currentTime=2.63;chime.motion(true);assert.equal(voices.length,5);chime.stop();assert(voices[4].stopped);
  chime.context.currentTime=0;chime.motion(true);assert.equal(voices.length,6);
});
test('重なる到着は最後の鐘の余韻まで移動音を抑え、操作音は消音中に発音しない',()=>{
  const {chime,voices}=fixture();chime.strike();chime.context.currentTime=1;chime.strike();chime.context.currentTime=2.7;chime.motion(true);assert.equal(voices.length,6);
  chime.context.currentTime=3.63;chime.motion(true);assert.equal(voices.length,7);chime.tap();assert.equal(voices.length,8);chime.mute();chime.tap();assert.equal(voices.length,8);
});
