import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gateChallenges} from '../src/content/gate-challenges.js';
import {gateVariants} from '../src/content/gate-variants.js';
import {legalWirings} from './random-challenge-validation.js';
import {challengeCircuit} from '../src/content/challenges.js';
import {Simulation} from '../src/core/simulation.js';
import {TimeScale} from '../src/core/time.js';

// Build-time pacing settings. These never change the runtime clock or cut off
// otherwise valid solutions. The source edge's authored duration is retained.
export const GATE_GENERATION=Object.freeze({
 phaseStep:'0.05',variantOffsetStep:'0.1',perfectArrivalLimit:'5',runDurationLimit:'12',
});
const add=(a,b)=>{const scale=new TimeScale([a,b]);return scale.format(scale.ticks(a)+scale.ticks(b));};
const rotated=(phase,delta,period)=>{
 const scale=new TimeScale([phase,delta,period]),p=scale.ticks(period);
 return scale.format(((scale.ticks(phase)-scale.ticks(delta))%p+p)%p);
};
export function runGate(problem,ids,offset='0'){
 const circuit=challengeCircuit(problem,ids),scale=new TimeScale([GATE_GENERATION.phaseStep,offset,...circuit.nodes.flatMap(n=>n.gate?Object.values(n.gate):[])]);
 for(const node of circuit.nodes)if(node.gate)node.gate.phase=scale.format((scale.ticks(node.gate.phase)+scale.ticks(offset))%scale.ticks(node.gate.period));
 const run=new Simulation(circuit);let steps=0;
 while(!run.exhausted){if(++steps>1024)throw Error('Gate proof did not exhaust '+problem.id);run.advanceNext();}
 const times=problem.goals.map(id=>run.arrivals(id)[0]?.time);
 return {run,actual:times.every(t=>t!==undefined)?Math.max(...times.map(Number)):null};
}
const bucket=()=>({count:0,maxDuration:'0',witness:null});
function mergeBucket(target,source){
 target.count+=source.count;
 if(source.witness&&(target.witness===null||Number(source.maxDuration)>Number(target.maxDuration))){
  target.maxDuration=source.maxDuration;target.witness=source.witness;
 }
 return target;
}
export function inspectGate(problem){
 const sets=legalWirings(problem),periods=[...new Set(problem.nodes.filter(n=>n.gate).map(n=>n.gate.period))];
 if(periods.length!==1)throw Error('Extend phase proof for mixed periods');
 const phaseStep=GATE_GENERATION.phaseStep;
 const values=[phaseStep,...problem.nodes.flatMap(n=>[n.process,...(n.gate?Object.values(n.gate):[])]),...problem.candidates.map(e=>e.time)];
 const scale=new TimeScale(values);
 if(values.some(value=>scale.ticks(value)%scale.ticks(phaseStep)!==0n))throw Error('Gate proof times must align with the exact phase step');
 const step=scale.ticks(phaseStep),period=scale.ticks(periods[0]);
 if(period%step!==0n)throw Error('Gate period must be divisible by the exact phase step');
 const phases=Number(period/step),rows=[],outcomes=new Map();let maximum=0;
 for(const ids of sets){
  let best=Infinity;const optimal=[];
  for(let tick=0;tick<phases;tick++){
   const phase=scale.format(step*BigInt(tick)),{run,actual}=runGate(problem,ids,phase),ended=run.format();
   maximum=Math.max(maximum,Number(ended));
   const key=actual===null?'failed':String(actual);
   if(!outcomes.has(key))outcomes.set(key,bucket());
   const outcome=outcomes.get(key);outcome.count++;
   if(outcome.witness===null||Number(ended)>Number(outcome.maxDuration)){
    outcome.maxDuration=ended;outcome.witness={edges:[...ids],phase,time:actual===null?null:String(actual)};
   }
   if(actual===null)continue;
   if(actual<best){best=actual;optimal.length=0;optimal.push(tick);}else if(actual===best)optimal.push(tick);
  }
  if(best!==Infinity)rows.push({edges:ids,time:best,phases:optimal});
 }
 rows.sort((a,b)=>a.time-b.time);
 const winner=rows[0],winners=winner?rows.filter(r=>r.time===winner.time).length:0;
 let streak=0,longest=0;const ticks=new Set(winner?.phases??[]);
 for(let tick=0;tick<phases*2;tick++){streak=ticks.has(tick%phases)?streak+1:0;longest=Math.min(phases,Math.max(longest,streak));}
 const partial=winner?rows.find(r=>r.time>winner.time):null,execution={perfect:bucket(),partial:bucket(),failed:bucket()};
 for(const [at,outcome]of outcomes)mergeBucket(execution[at==='failed'?'failed':Number(at)===winner?.time?'perfect':'partial'],outcome);
 const window=scale.format(step*BigInt(longest));
 return {legalWirings:sets.length,phaseStep,phaseSamples:phases,combinations:sets.length*phases,winner:winner?.edges??[],winners,baseline:winner?.time?.toString()??null,optimalPhases:winner?.phases.map(t=>scale.format(step*BigInt(t)))??[],perfectWindowSeconds:Number(window),partial:partial?{time:String(partial.time),edges:partial.edges,phase:scale.format(step*BigInt(partial.phases[0]))}:null,maxDuration:String(maximum),execution,valid:winners===1&&Boolean(partial)&&Number(window)>=1};
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
function translatedExecution(problem,execution,delta,period,baseline){
 return Object.fromEntries(Object.entries(execution).map(([category,metric])=>{
  if(!metric.witness)return [category,structuredClone(metric)];
  const witness={...metric.witness,phase:rotated(metric.witness.phase,delta,period)};
  const checked=runGate(problem,witness.edges,witness.phase);
  const maxDuration=metric.maxDuration==='0'?'0':add(metric.maxDuration,delta);
  if(checked.run.format()!==maxDuration)throw Error('Execution witness translation disagrees '+problem.id+' '+category);
  if(category==='failed'?checked.actual!==null:category==='perfect'?String(checked.actual)!==baseline:checked.actual===null||checked.actual<=Number(baseline))throw Error('Execution classification translation disagrees '+problem.id+' '+category);
  witness.time=checked.actual===null?null:String(checked.actual);
  return [category,{count:metric.count,maxDuration,witness}];
 }));
}
export function generateGateChallenges(only=null){
 if(only&&!gateChallenges.some(c=>c.id===only))throw Error('Unknown gate challenge '+only);
 const banks=only?structuredClone(gateVariants):{},proof=only?JSON.parse(readFileSync('設計検証/星刻の開廊/proof.json','utf8')):{kind:'periodic-prisms',stages:[]};
 proof.phaseStep=GATE_GENERATION.phaseStep;
 if(only)proof.stages=proof.stages.filter(row=>row.challenge!==only);
 for(const authored of gateChallenges.filter(c=>!only||c.id===only)){
  const bank=[],families=[];
  for(let family=0;family<2;family++){
   const base=familyProblem(authored,family),result=inspectGate(base);
   console.log(authored.id+' family '+family+' winners='+result.winners+' partial='+Boolean(result.partial)+' window='+result.perfectWindowSeconds+' max='+result.maxDuration);
   if(!result.valid||result.winner.length!==authored.limit)throw Error('Gate problem needs revision '+JSON.stringify(result));
   families.push(result.winner);
   // The one source edge is common to every run with future events. Increasing
   // it by delta rotates ALL sampled phases and shifts ALL later times exactly.
   if(base.candidates.filter(e=>e.from==='S').length!==1||base.candidates[0].from!=='S')throw Error('Phase-shift proof requires one common source edge');
   const sourceTime=base.candidates[0].time,period=base.nodes.find(n=>n.gate).gate.period;
   const offsets=new TimeScale([GATE_GENERATION.variantOffsetStep,GATE_GENERATION.phaseStep]);
   if(offsets.ticks(GATE_GENERATION.variantOffsetStep)%offsets.ticks(GATE_GENERATION.phaseStep)!==0n)throw Error('Variant offset must align with phase samples');
   for(let variant=0;variant<4;variant++){
    const delta=offsets.format(offsets.ticks(GATE_GENERATION.variantOffsetStep)*BigInt(variant)),problem=structuredClone(base);
    problem.candidates[0].time=add(sourceTime,delta);
    const phase=rotated(result.optimalPhases[0],delta,period),check=runGate(problem,result.winner,phase),baseline=add(result.baseline,delta);
    if(String(check.actual)!==baseline)throw Error('Phase mapping disagrees '+authored.id);
    const partialPhase=rotated(result.partial.phase,delta,period),partial=runGate(problem,result.partial.edges,partialPhase);
    if(partial.actual===null||partial.actual<=Number(baseline))throw Error('Lost partial gate clear');
    const maxDuration=add(result.maxDuration,delta),execution=translatedExecution(problem,result.execution,delta,period,baseline);
    if(Number(baseline)>Number(GATE_GENERATION.perfectArrivalLimit)||Number(maxDuration)>Number(GATE_GENERATION.runDurationLimit))throw Error('Gate timing exceeds pacing budget '+authored.id);
    if(execution.perfect.count+execution.partial.count+execution.failed.count!==result.combinations)throw Error('Missing classified gate cases');
    const id=createHash('sha256').update(JSON.stringify(problem)).digest('hex').slice(0,16);
    bank.push({id,baseVersion:authored.version,family,times:problem.candidates.map(e=>e.time),baseline,maxDuration});
    proof.stages.push({challenge:problem.id,id,family,variant,...result,baseline,maxDuration,execution,optimalPhases:result.optimalPhases.map(at=>rotated(at,delta,period)).sort((a,b)=>Number(a)-Number(b)),optimalPhase:phase,partial:{...result.partial,time:String(partial.actual),phase:partialPhase},derivation:variant?'bijective phase rotation and uniform time translation':'exhaustive',delta});
   }
  }
  if(JSON.stringify(families[0])===JSON.stringify(families[1]))throw Error('Gate families have same winner '+authored.id);
  banks[authored.id]=bank;
 }
 mkdirSync('設計検証/星刻の開廊',{recursive:true});
 writeFileSync('src/content/gate-variants.js','// Generated by scripts/generate-gate-challenges.js.\nexport const gateVariants = '+JSON.stringify(banks,null,2)+';\n');
 writeFileSync('設計検証/星刻の開廊/proof.json',JSON.stringify(proof,null,2)+'\n');
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/generate-gate-challenges.js'))generateGateChallenges(process.argv[2]??null);
