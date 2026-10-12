import test from 'node:test';
import assert from 'node:assert/strict';
import { LoadMeter } from '../src/ui/load-meter.js';
import { Simulation } from '../src/core/simulation.js';
import { sampleCircuit } from '../src/content/samples.js';

test('計算・描画・音・記録の実測を分け、長い単発と続く遅い描画を検出する',()=>{
  let now=0;const meter=new LoadMeter(()=>now);
  meter.begin();meter.measure('calculation',()=>{now+=5;});meter.measure('audio',()=>{now+=2;});meter.measure('display',()=>{now+=3;});meter.measure('records',()=>{now+=1;});
  assert.equal(meter.finish({active:999999,records:10000000}),false,'数量を停止ルールにしない');
  assert.deepEqual(meter.last.phases,{calculation:5,audio:2,display:3,records:1});
  for(let i=0;i<3;i++){meter.begin();meter.measure('display',()=>{now+=60;});assert.equal(meter.finish({}),i===2);}
  meter.begin();now+=1;assert.equal(meter.finish({}),false);assert.equal(meter.slowFrames,0);
  meter.begin();meter.measure('audio',()=>{now+=130;});assert.equal(meter.finish({}),true);
});
test('時間の予算を超えた同時刻処理を保持し、再開後は通常の全記録と一致する',()=>{
  let now=0;const meter=new LoadMeter(()=>now),run=new Simulation(sampleCircuit('loop')),reference=new Simulation(sampleCircuit('loop'));
  meter.begin();run.advanceUntil('9',{shouldPause:()=>{now+=3;return meter.calculationExceeded();}});
  assert.equal(run.pauseReason,'load');const before=structuredClone(run.records),particles=run.particles.size;
  assert(run.events.size>0);assert(particles>0);meter.finish({records:run.records.length,particles});
  run.resume();run.advanceUntil('9');reference.advanceUntil('9');assert.deepEqual(run.records,reference.records);assert.deepEqual(run.records.slice(0,before.length),before);
});

test('計算内の保存処理を二重計上せず、例外でも測定状態を閉じる',()=>{
  let now=0;const meter=new LoadMeter(()=>now);meter.begin();
  assert.throws(()=>meter.measure('calculation',()=>{now+=3;meter.measure('records',()=>{now+=8;});now+=2;throw new Error('Synthetic failure');}));
  meter.finish({});assert.deepEqual(meter.last.phases,{records:8,calculation:5});assert.equal(meter.stack.length,0);
});
