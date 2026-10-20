import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {gateChallenges} from '../src/content/gate-challenges.js';
import {legalWirings} from './random-challenge-validation.js';
import {challengeCircuit} from '../src/content/challenges.js';
import {Simulation} from '../src/core/simulation.js';
import {TimeScale} from '../src/core/time.js';
export function runGate(problem,ids,offset='0'){
 const circuit=challengeCircuit(problem,ids),scale=new TimeScale(['0.1',offset,...circuit.nodes.flatMap(n=>n.gate?Object.values(n.gate):[])]);
 for(const node of circuit.nodes)if(node.gate)node.gate.phase=scale.format((scale.ticks(node.gate.phase)+scale.ticks(offset))%scale.ticks(node.gate.period));
 const run=new Simulation(circuit);let steps=0;
 while(!run.exhausted){if(++steps>1024)throw Error('Gate proof did not exhaust '+problem.id);run.advanceNext();}
 const times=problem.goals.map(id=>run.arrivals(id)[0]?.time);
 return {run,actual:times.every(t=>t!==undefined)?Math.max(...times.map(Number)):null};
}
export function inspectGate(problem){
 const sets=legalWirings(problem),periods=[...new Set(problem.nodes.filter(n=>n.gate).map(n=>n.gate.period))];
 if(periods.length!==1)throw Error('Extend phase proof for mixed periods');
 const phases=Math.round(Number(periods[0])*10),rows=[];let maximum=0;
 for(const ids of sets){
  let best=Infinity;const optimal=[];
  for(let tick=0;tick<phases;tick++){
   const {run,actual}=runGate(problem,ids,String(tick/10));maximum=Math.max(maximum,Number(run.format()));
   if(actual===null)continue;
   if(actual<best){best=actual;optimal.length=0;optimal.push(tick);}else if(actual===best)optimal.push(tick);
  }
  if(best!==Infinity)rows.push({edges:ids,time:best,phases:optimal});
 }
 rows.sort((a,b)=>a.time-b.time);
 const winner=rows[0],winners=winner?rows.filter(r=>r.time===winner.time).length:0;
 let streak=0,longest=0;const ticks=new Set(winner?.phases??[]);
 for(let tick=0;tick<phases*2;tick++){streak=ticks.has(tick%phases)?streak+1:0;longest=Math.min(phases,Math.max(longest,streak));}
 const partial=rows.find(r=>r.time>winner.time);
 return {legalWirings:sets.length,phaseSamples:phases,combinations:sets.length*phases,winner:winner?.edges??[],winners,baseline:winner?.time?.toString()??null,optimalPhases:winner?.phases.map(t=>String(t/10))??[],perfectWindowSeconds:longest/10,partial:partial?{time:String(partial.time),edges:partial.edges,phase:String(partial.phases[0]/10)}:null,maxDuration:String(maximum),valid:winners===1&&Boolean(partial)&&longest>=10};
}
function familyProblem(authored,family){
 const problem=structuredClone(authored);if(!family)return problem;
 const swap=(a,b)=>{const x=problem.candidates.find(e=>e.id===a),y=problem.candidates.find(e=>e.id===b);if(x&&y)[x.time,y.time]=[y.time,x.time];};
 if(['Q41','Q42'].includes(problem.id)){swap('AB','AC');swap('BG','CG');}
 if(problem.id==='Q43'){swap('BG1','CG1');swap('BG2','CG2');}
 if(problem.id==='Q44'){swap('AB','AC');swap('BD','CD');}
 if(problem.id==='Q45')swap('BD','CD');
 if(problem.id==='Q46'){swap('MB','MC');swap('BD','CD');}
 return problem;
}
export function generateGateChallenges(){
 const banks={},proof={kind:'periodic-prisms',phaseStep:'0.1',stages:[]};
 for(const authored of gateChallenges){
  const bank=[],families=[];
  for(let family=0;family<2;family++){
   const base=familyProblem(authored,family),result=inspectGate(base);
   console.log(authored.id+' family '+family+' winners='+result.winners+' partial='+Boolean(result.partial)+' window='+result.perfectWindowSeconds);
   if(!result.valid||result.winner.length!==authored.limit)throw Error('Gate problem needs revision '+JSON.stringify(result));
   families.push(result.winner);
   // Every nonempty run starts with this one mandatory source edge. Increasing
   // it by delta maps ALL wirings and ALL sampled phases bijectively to the
   // base problem at (phase+delta), with all later records shifted by delta.
   if(base.candidates.filter(e=>e.from==='S').length!==1||base.candidates[0].from!=='S')throw Error('Phase-shift proof requires one common source edge');
   for(let variant=0;variant<4;variant++){
    const problem=structuredClone(base),delta=Math.round(variant*2)/10;problem.candidates[0].time=String(Math.round((.5+delta)*10)/10);
    const period=Number(problem.nodes.find(n=>n.gate).gate.period),phase=String(Math.round(((Number(result.optimalPhases[0])-delta+period)%period)*10)/10);
    const check=runGate(problem,result.winner,phase),baseline=String(Math.round((Number(result.baseline)+delta)*10)/10);
    if(String(check.actual)!==baseline)throw Error('Phase mapping disagrees '+authored.id);
    const partialPhase=String(Math.round(((Number(result.partial.phase)-delta+period)%period)*10)/10),partial=runGate(problem,result.partial.edges,partialPhase);
    if(partial.actual===null||partial.actual<=Number(baseline))throw Error('Lost partial gate clear');
    const id=createHash('sha256').update(JSON.stringify(problem)).digest('hex').slice(0,16);
    bank.push({id,baseVersion:1,family,times:problem.candidates.map(e=>e.time),baseline,maxDuration:String(Math.round((Number(result.maxDuration)+delta)*10)/10)});
    proof.stages.push({challenge:problem.id,id,family,variant,...result,baseline,maxDuration:bank.at(-1).maxDuration,optimalPhase:phase,partial:{...result.partial,time:String(partial.actual),phase:partialPhase},derivation:variant?'bijective phase rotation and uniform time translation':'exhaustive',delta:String(Math.round(delta*10)/10)});
   }
  }
  if(JSON.stringify(families[0])===JSON.stringify(families[1]))throw Error('Gate families have same winner '+authored.id);
  banks[authored.id]=bank;
 }
 mkdirSync('設計検証/星刻の開廊',{recursive:true});
 writeFileSync('src/content/gate-variants.js','// Generated by scripts/generate-gate-challenges.js.\nexport const gateVariants = '+JSON.stringify(banks,null,2)+';\n');
 writeFileSync('設計検証/星刻の開廊/proof.json',JSON.stringify(proof,null,2));
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/generate-gate-challenges.js'))generateGateChallenges();
