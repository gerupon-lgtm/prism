import test from 'node:test';
import assert from 'node:assert/strict';
import { createCircuit } from '../src/core/circuit.js';
import { faultCases, worstFault, timeScore, timeHopScore, compareScores, perfectScore, displayScore } from '../src/core/evaluation.js';

const diamond = {mode:'fastest',target:'G',nodes:[{id:'S',kind:'source',process:'0'}, {id:'A',kind:'prism',process:'0'}, {id:'B',kind:'prism',process:'0'}, {id:'G',kind:'goal',process:'0'}],edges:[
  {id:'SA',from:'S',to:'A',time:'1'}, {id:'AG',from:'A',to:'G',time:'1'},
  {id:'SB',from:'S',to:'B',time:'2'}, {id:'BG',from:'B',to:'G',time:'2'},
]};
test('一本故障の全ケースを元の回路から独立に計算し、最悪時間を選ぶ', () => {
  const cases = faultCases(diamond,'edge','G');
  assert.equal(cases.length, 4);
  assert.ok(cases.every(c => c.reachable));
  assert.deepEqual(cases.map(c=>[c.id,c.time]), [['AG','4'],['BG','2'],['SA','4'],['SB','2']]);
  assert.equal(worstFault(cases,createCircuit(diamond).time).time,'4');
  assert.ok(diamond.edges.every(e=>e.enabled === undefined));
});
test('中継点故障は出発点・祭壇を除き、到達不能のケースを隠さない', () => {
  const cases = faultCases(diamond,'prism','G');
  assert.deepEqual(cases.map(c=>[c.id,c.time]), [['A','4'],['B','2']]);
  const graph = structuredClone(diamond); graph.edges[2].enabled=false;
  const failures = faultCases(graph,'prism','G');
  assert.equal(worstFault(failures,createCircuit(graph).time).reachable,false);
});
test('確定した時間の式：最短2秒・今回4秒は75点、基準時間なら100点', () => {
  assert.equal(displayScore(timeScore(40n,20n)), '75.00');
  assert.equal(perfectScore(timeScore(20n,20n)), true);
  assert.throws(()=>timeScore(10n,20n));
});
test('時間と本数の技術案は時間を第一、同時刻なら本数を第二にする', () => {
  assert.ok(compareScores(timeHopScore(50n,5,50n,2,6),timeHopScore(51n,1,50n,2,6)) > 0);
  assert.ok(compareScores(timeHopScore(50n,2,50n,2,6),timeHopScore(50n,3,50n,2,6)) > 0);
  assert.equal(perfectScore(timeHopScore(50n,2,50n,2,6)), true);
  const near = timeHopScore(500n,3,500n,2,6);
  assert.equal(perfectScore(near), false);
  assert.equal(displayScore(near),'99.99');
});
