// Build/test only. All selected and unselected candidate combinations count.
import { Simulation } from '../src/core/simulation.js';
import { challengeCircuit } from '../src/content/challenges.js';
import {bellSequenceResult} from '../src/core/bell-sequence.js';

export function legalWirings(challenge) {
  if(challenge.candidates.length>16)throw new Error('この全列挙検証器の規模を超えています。検証方法の拡張が必要です。');
  const sets=[];
  for(let mask=0;mask<2**challenge.candidates.length;mask++){
    const ids=challenge.candidates.filter((_,i)=>mask&2**i).map(e=>e.id);
    if(ids.length<=challenge.limit)sets.push(ids);
  }
  return sets;
}
export function simulateWiring(challenge,ids){
  const run=new Simulation(challengeCircuit(challenge,ids));
  for(let i=0;!run.exhausted&&i<2048;i++)run.advanceNext();
  if(!run.exhausted)throw new Error('出題の動作終了を確認できません。');
  return run;
}
export function inspectProblem(challenge,sets=legalWirings(challenge)){
  let best=null,maximum=0n,winners=0,achieved=0,purposeFailures=0;
  const results=new Map();
  const scale=simulateWiring(challenge,[]).circuit.time;
  for(const ids of sets){
    const run=simulateWiring(challenge,ids);
    if(run.clock>maximum)maximum=run.clock;
    let at=null;
    if(challenge.type==='bell-sequence'){
      const result=bellSequenceResult(challenge,run);if(result.state==='achieved')at=scale.ticks(result.actual);
    }else if(challenge.type==='delivery-all'){
      const arrivals=challenge.goals.map(id=>run.arrivals(id)[0]?.time);
      if(arrivals.every(t=>t!==undefined))at=arrivals.map(t=>scale.ticks(t)).reduce((a,b)=>a>b?a:b);
    }else{
      const result=run.intervalResult(challenge.goal,challenge.interval,challenge.count);
      if(result.state==='achieved')at=scale.ticks(result.first);
    }
    if(at===null)continue;
    achieved++;
    const branches=new Set(run.records.filter(r=>r.type==='branch'&&run.circuit.nodes.get(r.node).kind==='prism').map(r=>r.node));
    const waiting=run.records.some(r=>r.type==='process-start'&&scale.ticks(r.wait)>0n);
    if(!branches.size||(['Q9','Q10'].includes(challenge.id)&&branches.size<2)||(['Q11','Q12'].includes(challenge.id)&&!waiting))purposeFailures++;
    if(!results.has(at))results.set(at,ids);
    if(best===null||at<best){best=at;winners=1;}else if(at===best)winners++;
  }
  const next=[...results.keys()].sort((a,b)=>a<b?-1:a>b?1:0).find(t=>best!==null&&t>best);
  const winner=best===null?[]:results.get(best);
  // A locally short, losing choice encourages comparison beyond individual edges.
  const traps=challenge.candidates.filter(e=>!winner.includes(e.id)&&challenge.candidates.some(w=>winner.includes(w.id)&&w.from===e.from&&scale.ticks(e.time)<scale.ticks(w.time))).map(e=>e.id);
  return {baseline:best===null?null:scale.format(best),maxDuration:scale.format(maximum),achieved,winners,purposeFailures,winner,
    partial:next===undefined?null:{time:scale.format(next),edges:results.get(next)},traps,
    valid:winners===1&&next!==undefined&&purposeFailures===0};
}
