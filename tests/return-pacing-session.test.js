import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/app/session.js';
import {LocalRecords,circuitFile,readCircuitFile} from '../src/core/storage.js';
import * as returning from '../src/core/return-pattern.js';

function fixture({interval='1.5',maxDuration='30',extra=false}={}) {
  const values=new Map(),records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const session=new Session(records);
  session.challenge={id:'return-pacing',version:1,name:'帰還の短い決着',type:'return-pattern',goal:'G',count:3,interval,baseline:'3.5',maxDuration,limit:extra?4:3};
  session.circuit={mode:'spread',target:'G',nodes:[{id:'S',kind:'source',process:'0.5'},{id:'A',kind:'prism',process:'0.2'},{id:'G',kind:'goal',process:'0'},...(extra?[{id:'T',kind:'prism',process:'0'}]:[])],edges:[{id:'SA',from:'S',to:'A',time:'0.4'},{id:'AS',from:'A',to:'S',time:'0.4'},{id:'SG',from:'S',to:'G',time:'0.5'},...(extra?[{id:'ST',from:'S',to:'T',time:'0.5'}]:[])]};
  return {session,records,values};
}

test('帰還の次の期限を正確なticksで公開し、初到達前と完了後には期限を設けない',()=>{
  const {session:s}=fixture();s.start();
  assert.equal(typeof returning.returnPatternDeadline,'function');
  assert.equal(returning.returnPatternDeadline(s.challenge,s.run),null);
  s.advance('0.5');assert.equal(returning.returnPatternDeadline(s.challenge,s.run),s.run.circuit.time.ticks('2'));
  s.advance('20');assert.equal(returning.returnPatternDeadline(s.challenge,s.run),null);
});

test('次の鐘が期限に来なければ、その時刻で失敗して将来の到達を再生しない',()=>{
  const {session:s}=fixture({interval:'1.4'});s.start();s.advance('1.8');
  assert.equal(s.result.state,'pending');assert.equal(s.run.exhausted,false);
  s.advance('20');assert.equal(s.run.format(),'1.9');assert.equal(s.result.state,'failed');
  assert.match(s.result.reason,/間隔|時刻/);assert.equal(s.run.exhausted,true);
  assert.deepEqual(s.run.arrivals('G').map(row=>row.time),['0.5']);
  assert(s.run.records.every(row=>s.run.circuit.time.ticks(row.time)<=s.run.clock));
  const result=s.exportResult();s.stop();assert.deepEqual(s.result,result.evaluation);assert.deepEqual(s.run.records,result.records);
});

test('期限より早い2回目の不一致では同時刻の0秒処理も完了し、大きな時間送りでも2秒で終了する',()=>{
  const {session:s}=fixture({interval:'1.6',extra:true});s.start();s.advance('20');
  assert.equal(s.run.format(),'2');assert.equal(s.result.state,'failed');assert.equal(s.run.exhausted,true);
  assert.deepEqual(s.run.arrivals('G').map(row=>row.time),['0.5','2']);
  assert(s.run.records.some(row=>row.type==='process-end'&&row.node==='T'&&row.time==='2'));
});

test('次動作と連続実行は期限にイベントがなくても同じ時刻と全記録で終了する',()=>{
  const direct=fixture({interval:'1.4'}).session,stepped=fixture({interval:'1.4'}).session;
  direct.start();direct.advance('20');stepped.start();stepped.pause();
  let steps=0;while(!stepped.run.exhausted&&steps++<30)stepped.next();
  assert(steps<30);assert.equal(stepped.run.format(),'1.9');assert.deepEqual(stepped.exportResult(),direct.exportResult());
});

test('期限での正しい到達を失敗にせず、停止再開でも時計と満点を保持する',()=>{
  const {session:s}=fixture();s.start();s.advance('1.9');s.pause();
  s.advance('20');assert.equal(s.run.format(),'1.9');s.resume();s.advance('2');
  assert.equal(s.result.state,'pending');assert.equal(s.run.exhausted,false);
  s.advance('20');assert.equal(s.run.format(),'3.5');assert.equal(s.result.state,'achieved');
  assert.deepEqual(s.result.score,{numerator:'100',denominator:'1'});
});

test('不一致の同時刻の途中で負荷停止しても残りを捨てず、再開後だけ完了する',()=>{
  const direct=fixture({interval:'1.6',extra:true}).session,paused=fixture({interval:'1.6',extra:true}).session;
  direct.start();direct.advance('20');paused.start();paused.advance('20',{shouldPause:run=>run.arrivals('G').length===2});
  assert.equal(paused.run.pauseReason,'load');assert.equal(paused.run.exhausted,false);assert.equal(paused.run.format(),'2');
  paused.resume();paused.advance('20');assert.deepEqual(paused.exportResult(),direct.exportResult());
});

test('期限ちょうどに負荷停止して未処理の到達が残っていれば、未到達の失敗にしない',()=>{
  const {session:s}=fixture({extra:true});s.circuit.edges.find(edge=>edge.id==='ST').time='2';
  s.start();s.advance('20',{shouldPause:run=>run.clock===run.circuit.time.ticks('2')&&run.arrivals('G').length===1});
  assert.equal(s.run.pauseReason,'load');assert.equal(s.run.format(),'2');assert.equal(s.result.state,'pending');
  assert.equal(s.run.exhausted,false);s.resume();s.advance('20');
  assert.equal(s.result.state,'achieved');assert.equal(s.run.format(),'3.5');
});

test('期限前の手動停止と安全上限は未確定の中断とし、旧保存回路・旧成績を変更しない',()=>{
  const {session:s,records,values}=fixture({interval:'1.4',maxDuration:'1.8'});
  records.saveScore('Q6@1','interval@1',{numerator:'100',denominator:'1'});
  const oldCircuit=circuitFile(s.circuit,'旧条件');records.saveCircuit(s.circuit,'旧条件',{id:'old'});
  const before=[...values.entries()];s.start();s.advance('20');
  assert.equal(s.run.format(),'1.8');assert.equal(s.result.state,'stopped');assert.equal(s.result.score,null);
  assert.deepEqual([...values.entries()],before);assert.deepEqual(readCircuitFile(JSON.stringify(oldCircuit)).circuit,records.slots()[0].circuit);
  const manual=fixture({interval:'1.4'}).session;manual.start();manual.advance('1.8');manual.stop();
  assert.equal(manual.result.state,'stopped');assert.equal(manual.result.score,null);
});

test('帰還以外の間隔課題と自由の循環には早期終了や帰還の期限を追加しない',()=>{
  const interval=fixture().session;interval.challenge={...interval.challenge,type:'interval',baseline:'0.5'};
  interval.start();interval.advance('5');assert.equal(interval.run.exhausted,false);
  assert.equal(interval.run.arrivals('G').length,4);assert.equal(interval.result.state,'failed');
  const free=fixture().session;free.replace({sampleId:'loop'});free.start();free.advance('9');
  assert.equal(free.run.exhausted,false);assert.equal(free.run.format(),'9');assert.equal(free.result.state,'running');
  assert.deepEqual(free.run.arrivals('G1').map(row=>row.time),['4','5','7','8']);
});
