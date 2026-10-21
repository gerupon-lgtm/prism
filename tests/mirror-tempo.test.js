import test from 'node:test';
import assert from 'node:assert/strict';
import {mirrorVariants} from '../src/content/mirror-variants.js';
import {readFileSync} from 'node:fs';
import {challenges,challengeCircuit} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {simulateWiring} from '../scripts/random-challenge-validation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {matchesChallengeScore} from '../src/core/challenge-identity.js';

test('鏡の6面は満点到達5秒以内、全経路8秒以内、道の移動1.2秒以内に収める',()=>{
 for(const [id,bank]of Object.entries(mirrorVariants))for(const draw of bank){
  assert(Number(draw.baseline)<=5,`${id}/${draw.id}: 満点でも${draw.baseline}秒待つ`);
  assert(Number(draw.maxDuration)<=8,`${id}/${draw.id}: ${draw.maxDuration}秒まで待つ`);
  assert(draw.times.every(t=>Number(t)<=1.2),`${id}/${draw.id}: 長い道がある`);
 }
});

test('鏡の導入面には1秒台で満点に届く出題を残す',()=>{
 assert(mirrorVariants.Q35.some(draw=>Number(draw.baseline)<2),'短い出題をそろえるために遅くしない');
});

test('複雑な二枚の鏡と三つの鐘も、1秒台で満点に届く出題を残す',()=>{
 assert(mirrorVariants.Q40.some(draw=>Number(draw.baseline)<2));
 const c=challenges.find(c=>c.id==='Q40');assert.equal(c.limit,8);assert.equal(c.goals.length,3);assert.equal(c.nodes.filter(n=>n.kind==='mirror').length,2);
});

test('呼び鈴の面は全8出題で0.1秒後に高音、0.5秒後に低音へ実際に到達する',()=>{
 const c=challenges.find(c=>c.id==='Q36'),proof=JSON.parse(readFileSync(new URL('../設計検証/月鏡の静殿/proof.json',import.meta.url)));
 assert.equal(c.type,'bell-sequence');assert.equal(c.instantStart,true);assert.deepEqual(c.bellPitches,[88,84]);assert.deepEqual(c.intervals,['0.5']);
 for(let i=0;i<8;i++){
  const draw=drawChallenge(c,{random:()=>i/8}),row=proof.stages.find(r=>r.id===draw.draw.id),run=simulateWiring(draw,row.winner);
  assert.deepEqual(draw.goals.map(g=>run.arrivals(g)[0].time),['0.1','0.6']);
 }
});

test('32面の旧全鐘到達の成績は、順番と間隔の新版でも残して区別する',()=>{
 const values=new Map(),records=new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});
 records.saveScore('Q36@2/random-1-old','delivery-all@1',{numerator:'100',denominator:'1'});const old=structuredClone(records.scores()[0]),s=new Session(records,{random:()=>0});
 s.replace({challengeId:'Q36'});assert(!matchesChallengeScore(old,s.challenge));
 const proof=JSON.parse(readFileSync(new URL('../設計検証/月鏡の静殿/proof.json',import.meta.url))),row=proof.stages.find(r=>r.id===s.challenge.draw.id);
 s.circuit=challengeCircuit(s.challenge,row.winner);s.start();s.advance(s.challenge.maxDuration);
 assert.equal(s.result.state,'achieved');assert.equal(records.scores().length,2);assert.deepEqual(records.scores().find(r=>r.challenge===old.challenge),old);
});
