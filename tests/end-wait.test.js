import test from 'node:test';
import assert from 'node:assert/strict';
import { EndWait, END_WAIT_MS } from '../src/ui/end-wait.js';
import { Session } from '../src/app/session.js';
import { LocalRecords } from '../src/core/storage.js';
import { sampleCircuit } from '../src/content/samples.js';

function session(){const data=new Map();return new Session(new LocalRecords({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}));}
test('全粒が終わってから3秒で編集へ戻し、時計・全記録・点数・配線を保持する',()=>{
  const s=session(),wait=new EndWait();s.connectPath(['S','A','G']);s.start();s.advance('2.5');
  const clock=s.run.clock,records=structuredClone(s.run.records),result=structuredClone(s.result),circuit=structuredClone(s.circuit);
  assert.equal(s.run.exhausted,true);assert.equal(s.editable,false);assert.equal(wait.ready(s.run,100),false);
  assert.equal(wait.ready(s.run,100+END_WAIT_MS-1),false);assert.equal(wait.ready(s.run,100+END_WAIT_MS),true);
  s.stop();assert.equal(s.editable,true);assert.equal(s.run.clock,clock);assert.deepEqual(s.run.records,records);assert.deepEqual(s.result,result);assert.deepEqual(s.circuit,circuit);assert.equal(wait.ready(s.run,10000),false);
});
test('最初のゴール後も後続粒が動いている間は待機を開始しない',()=>{
  const s=session(),wait=new EndWait();s.replace({sampleId:'compare'});
  const circuit=sampleCircuit();circuit.target='all';circuit.nodes.push({id:'G2',kind:'goal',x:.7,y:.85,process:'0'});circuit.edges.push({id:'SG2',from:'S',to:'G2',time:'10'});s.commitEdit(circuit);s.start();s.advance('2.5');
  assert.equal(s.run.arrivals().length,1);assert.equal(wait.ready(s.run,100),false);assert.equal(wait.ready(s.run,10000),false);
  s.advance('10');assert.equal(s.run.arrivals().length,2);assert.equal(wait.ready(s.run,11000),false);assert.equal(wait.ready(s.run,13999),false);assert.equal(wait.ready(s.run,14000),true);
});
test('手動停止・別の実行・到達なし・負荷停止へ古い待機を持ち越さない',()=>{
  const s=session(),wait=new EndWait();s.connectPath(['S','A','G']);s.start();s.advance('2.5');wait.ready(s.run,0);
  s.stop();assert.equal(s.editable,true);assert.equal(wait.ready(s.run,1),false);s.start();assert.equal(wait.ready(s.run,5000),false);
  s.advance('2.5');assert.equal(wait.ready(s.run,6000),false);assert.equal(wait.ready(s.run,8999),false);assert.equal(wait.ready(s.run,9000),true);
  s.pause('load');assert.equal(wait.ready(s.run,10000),false);
  s.openRecords();assert.equal(wait.ready(s.run,11000),false);assert.equal(wait.ready(s.run,20000),false);
  const unreachable=session();unreachable.connect('S','A');unreachable.start();assert.equal(unreachable.run.exhausted,true);assert.equal(wait.ready(unreachable.run,20000),false);assert.equal(wait.ready(unreachable.run,50000),false);assert.equal(wait.ready(null,60000),false);
});
test('次動作の終了も3秒で戻せるが、終了フレームのエラーを閲覧や別実行で解除しない',()=>{
  const s=session(),wait=new EndWait();s.connectPath(['S','A','G']);s.start();s.pause();
  while(!s.run.exhausted)s.next();assert.equal(s.run.format(),'2.5');assert.equal(wait.ready(s.run,0),false);assert.equal(wait.ready(s.run,3000),true);
  s.pause('error');wait.interrupt(s.run);const interrupted=s.run;
  s.pause('dialog');assert.equal(wait.ready(s.run,7000),false);
  const other=session();other.connect('S','A');other.start();wait.ready(other.run,8000);assert.equal(wait.ready(interrupted,12000),false);assert.equal(s.editable,false);
});
