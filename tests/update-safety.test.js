import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/app/session.js';
import { LocalRecords } from '../src/core/storage.js';
import { updateSafety } from '../src/app/update-safety.js';

test('更新を許す前に実行・未保存回路・案内の元状態を保護する',()=>{
  const values=new Map();let failing=false;
  const s=new Session(new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failing)throw new Error('Synthetic quota failure');values.set(key,value);}}));
  assert.equal(updateSafety(s).kind,'confirm');
  s.replace({sampleId:'compare'});s.setTime('A','1.5');
  const circuit=structuredClone(s.circuit);
  assert.equal(updateSafety(s).kind,'circuit');assert.deepEqual(s.circuit,circuit);
  s.start();assert.equal(updateSafety(s).kind,'running');s.pause();assert.equal(updateSafety(s).kind,'running');
  s.beginGuide();assert.equal(updateSafety(s).kind,'guide');s.endGuide('interrupted');assert.deepEqual(s.circuit,circuit);
  assert.equal(updateSafety(s).kind,'running');s.stop();
  failing=true;assert.throws(()=>s.saveCircuit('未保存'));assert.equal(updateSafety(s).kind,'circuit');
  failing=false;s.saveCircuit('保存済み');assert.equal(updateSafety(s).kind,'confirm');
});

test('画面を変えても未保存の成績がある限り更新を許さない',()=>{
  const values=new Map();let failing=true;
  const s=new Session(new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failing)throw new Error('Synthetic quota failure');values.set(key,value);}}));
  s.connect('S','A');s.connect('A','G');s.start();s.advance('2.5');s.stop();
  assert.equal(updateSafety(s).kind,'scores');
  s.replace({sampleId:'compare'});s.setTime('A','1.5');
  assert.equal(updateSafety(s).kind,'scores');
  const key=[...s.pendingScores.keys()][0];assert.equal(s.retryScore(key),false);assert.equal(updateSafety(s).kind,'scores');
  failing=false;assert.equal(s.retryScore(key),true);assert.equal(updateSafety(s).kind,'circuit');
});
