import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/core/simulation.js';

const nodes = () => [{id:'S',kind:'source',process:'0'}, ...['A','B','C'].map(id=>({id,kind:'prism',process:'0'})), {id:'G',kind:'goal',process:'0'}];
const edge = (id,from,to,time,bidirectional=false) => ({id,from,to,time,bidirectional});

test('例A：鐘へ出られない循環が残っても実到達1・3・5秒で達成する', () => {
  const run = new Simulation({mode:'spread',nodes:nodes(), edges:[
    edge('g1','S','G','1'), edge('g2','S','G','3'), edge('g3','S','G','5'),
    edge('sa','S','A','0.5'), edge('ab','A','B','0.5'), edge('bc','B','C','0.5'), edge('ca','C','A','0.5'),
  ]});
  run.advanceUntil('4.5');
  assert.equal(run.intervalResult('G','2',3).state, 'pending');
  run.advanceUntil('5');
  assert.deepEqual(run.intervalResult('G','2',3), {state:'achieved',first:'1'});
  assert.equal(run.exhausted, false);
});

test('例B：鐘へ出る循環では1・3・5秒の三到達後も追加があるため未達成', () => {
  const run = new Simulation({mode:'spread',nodes:nodes(),edges:[
    edge('sa','S','A','0.5'),edge('ag','A','G','0.5'),edge('ab','A','B','0.5'),edge('bc','B','C','0.5'),edge('ca','C','A','1'),
  ]});
  run.advanceUntil('5');
  assert.deepEqual(run.arrivals().map(e=>e.time), ['1','3','5']);
  assert.equal(run.hasFutureArrival('G'), true);
  assert.equal(run.intervalResult('G','2',3).state, 'failed');
});

test('直前の道を除く：単に地点がつながっていても、送り返せない道の先は将来到達にしない', () => {
  const run = new Simulation({mode:'spread',nodes:nodes(),edges:[
    edge('sa','S','A','1',true), edge('sg','S','G','1'),
  ]});
  run.advanceUntil('1');
  assert.equal(run.hasFutureArrival('G'), false);
  assert.equal(run.intervalResult('G','2',1).state, 'achieved');
});

test('移動中と長い待ち列も将来到達へ含め、別の鐘で終了する道筋は転送しない', () => {
  const graph = {mode:'spread',nodes:[{id:'S',kind:'source',process:'0'},{id:'A',kind:'prism',process:'10'}, {id:'G',kind:'goal',process:'0'}, {id:'H',kind:'goal',process:'0'}],edges:[
    edge('a','S','A','1'),edge('b','S','A','1'),edge('ag','A','G','1'),edge('sh','S','H','1'),edge('hg','H','G','1'),
  ]};
  const run = new Simulation(graph);
  assert.equal(run.hasFutureArrival('G'), true);
  run.advanceUntil('12');
  assert.equal(run.intervalResult('G','10',2).state, 'pending');
  run.advanceUntil('22');
  assert.deepEqual(run.arrivals('G').map(e=>e.time), ['12','22']);
  assert.equal(run.intervalResult('G','10',2).state, 'achieved');
  assert.equal(run.records.filter(e=>e.type==='travel' && e.edge==='hg').length, 0);
});

test('間隔は厳密一致で、停止後も確定した結果を保持し、未確定の途中停止とは区別する', () => {
  const run = new Simulation({mode:'spread',nodes:nodes(),edges:[edge('1','S','G','1'),edge('2','S','G','3.1')]});
  run.advanceUntil('3.1');
  assert.equal(run.intervalResult('G','2',2).state, 'failed');
  run.stop();
  assert.equal(run.intervalResult('G','2',2).state, 'failed');
  const unfinished=new Simulation({mode:'spread',nodes:nodes(),edges:[edge('1','S','G','1')]});
  assert.equal(unfinished.intervalResult('G','2',1).state,'pending');
  unfinished.stop();
  assert.equal(unfinished.intervalResult('G','2',1).state,'stopped');
  const achieved=new Simulation({mode:'spread',nodes:nodes(),edges:[edge('1','S','G','1')]});
  assert.equal(achieved.intervalResult('G','2',1).state,'pending');
  achieved.advanceUntil('1');
  achieved.stop();
  assert.equal(achieved.intervalResult('G','2',1).state,'achieved');
});
