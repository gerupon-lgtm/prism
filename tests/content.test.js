import test from 'node:test';
import assert from 'node:assert/strict';
import { challenges, challengeCircuit } from '../src/content/challenges.js';
import { sampleCircuit } from '../src/content/samples.js';
import { Simulation } from '../src/core/simulation.js';

function bestRoute(nodes,edges) {
  const solutions=[];
  const search=(current,seen,cost,hops)=>{
    if(current==='G') { solutions.push({cost,hops}); return; }
    for(const edge of edges) {
      if(edge.from!==current || edge.enabled===false || seen.has(edge.to)) continue;
      const next=nodes.find(n=>n.id===edge.to);
      if(next.enabled===false) continue;
      search(edge.to,new Set([...seen,edge.to]),cost+Math.round(Number(edge.time)*10)+(next.kind==='goal'?0:Math.round(Number(next.process)*10)),hops+1);
    }
  };
  search('S',new Set(['S']),0,0);
  solutions.sort((a,b)=>a.cost-b.cost || a.hops-b.hops);
  return solutions[0] ?? null;
}
function selections(candidates,limit) {
  const result=[];
  for(let mask=0;mask<2**candidates.length;mask++) {
    const selected=candidates.filter((_,index)=>mask & 2**index);
    if(selected.length<=limit) result.push(selected);
  }
  return result;
}
test('実際に使う自由2見本は資料の2.5秒と4・5・7・8秒の到達を再現する',()=>{
  const compare=new Simulation(sampleCircuit('compare')); compare.advanceUntil('3');
  assert.deepEqual(compare.arrivals().map(e=>e.time),['2.5']);
  const loop=new Simulation(sampleCircuit('loop')); loop.advanceUntil('9');
  assert.deepEqual(loop.arrivals('G1').map(e=>e.time),['4','5','7','8']);
});
test('課題Q1～Q5の全接続組合せを独立した経路列挙で照合し、複数の最高評価構成を持つ',()=>{
  for(const challenge of challenges.slice(0,5)) {
    const achieved=[];
    for(const edges of selections(challenge.candidates,challenge.limit)) {
      if(challenge.type==='edge-fault' || challenge.type==='prism-fault') {
        const targets=challenge.type==='edge-fault'?edges:challenge.nodes.filter(n=>n.kind==='prism');
        if(!targets.length) continue;
        const cases=targets.map(target=>bestRoute(challenge.nodes.map(n=>({...n,enabled:!(challenge.type==='prism-fault'&&n.id===target.id)})),edges.filter(e=>!(challenge.type==='edge-fault'&&e.id===target.id))));
        if(cases.every(Boolean)) achieved.push({cost:Math.max(...cases.map(c=>c.cost)),hops:0});
      } else {
        const route=bestRoute(challenge.nodes,edges);
        if(route) achieved.push(route);
      }
    }
    achieved.sort((a,b)=>a.cost-b.cost || (challenge.type==='time-hops'?a.hops-b.hops:0));
    assert.equal(achieved[0].cost,Math.round(Number(challenge.baseline)*10),challenge.id);
    if(challenge.type==='time-hops') assert.equal(achieved[0].hops,challenge.baselineHops);
    assert.ok(achieved.filter(value=>value.cost===achieved[0].cost && (challenge.type!=='time-hops'||value.hops===achieved[0].hops)).length>=2,challenge.id+' best alternatives');
  }
});
test('Q6は全制限内の接続を判定し、初回1秒が実現可能で複数構成が満点条件を満たす',()=>{
  const challenge=challenges[5];
  const minimumPath=bestRoute(challenge.nodes,challenge.candidates);
  assert.equal(minimumPath.cost,10); // A positive cycle cannot beat this lower bound.
  const achieved=[];
  for(const edges of selections(challenge.candidates,challenge.limit)) {
    const run=new Simulation(challengeCircuit(challenge,edges.map(e=>e.id)));
    let result=run.intervalResult('G','2',3);
    let steps=0;
    while(result.state==='pending') {
      assert.ok(++steps<=1024,'This finite content fixture did not resolve; no app cutoff is imposed.');
      run.advanceNext(); result=run.intervalResult('G','2',3);
    }
    if(result.state==='achieved') achieved.push(result.first);
  }
  assert.ok(achieved.filter(first=>first==='1').length>=2);
  assert.ok(achieved.every(first=>Number(first)>=1));
});
