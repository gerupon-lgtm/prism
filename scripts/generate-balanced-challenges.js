// Targeted offline generation. The lightweight DAG clock proposes seeds only;
// random-challenge-validation.js remains the authority for every shipped draw.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {challenges} from '../src/content/challenges.js';
import {randomVariants} from '../src/content/random-variants.js';
import {inspectProblem,legalWirings} from './random-challenge-validation.js';

const bankPath='src/content/random-variants.js';
const proofPath='設計検証/ランダム課題/generation.json';
// The ceiling is a fixed pre-revision input, never the previous generation's
// output. Repeating this command therefore cannot progressively narrow search.
const baselineBanks=JSON.parse(readFileSync(new URL('../tests/fixtures/pre-balanced-0.87.json',import.meta.url),'utf8')).banks;
const ticks=value=>{
 const result=Number(value)*100;
 if(!Number.isFinite(result)||Math.abs(result-Math.round(result))>1e-7)throw Error('Generation requires exact hundredth-second values: '+value);
 return Math.round(result);
};
const seconds=value=>String(Math.round(value)/100);
const signature=ids=>[...ids].sort().join(',');

function stream(id){
 let state=(0x20261023^Number(id.slice(1)))>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}

// Processing at a DAG node is FIFO with one fixed service duration. Sorting all
// arrivals after its predecessors have finished gives the same finish times as
// the event queue. It is deliberately limited to positive directed DAGs: a
// cyclic graph, gate, mirror or unsupported objective must use another proposer.
export function compileBalancedGraph(challenge){
 if(!['interval','delivery-all','bell-sequence'].includes(challenge.type))throw Error('Unsupported balanced objective '+challenge.id);
 if(challenge.nodes.some(n=>n.gate||!['source','prism','goal'].includes(n.kind)))throw Error('Balanced proposer supports ordinary finite prisms only');
 const nodeIndex=new Map(challenge.nodes.map((n,i)=>[n.id,i]));
 const source=challenge.nodes.findIndex(n=>n.kind==='source');
 if(source<0||challenge.nodes.filter(n=>n.kind==='source').length!==1)throw Error('Exactly one source is required');
 const edges=challenge.candidates.map((e,i)=>({index:i,from:nodeIndex.get(e.from),to:nodeIndex.get(e.to)}));
 if(edges.some(e=>e.from===undefined||e.to===undefined))throw Error('Unknown candidate endpoint');
 const incoming=challenge.nodes.map(()=>0),allOutgoing=challenge.nodes.map(()=>[]);
 for(const e of edges){incoming[e.to]++;allOutgoing[e.from].push(e);}
 const order=[],todo=incoming.flatMap((count,i)=>count?[]:[i]);
 while(todo.length){const at=todo.shift();order.push(at);for(const e of allOutgoing[at])if(--incoming[e.to]===0)todo.push(e.to);}
 if(order.length!==challenge.nodes.length)throw Error('Balanced proposer requires a DAG; expand the proposer without excluding cyclic verification');
 const sets=legalWirings(challenge),goals=(challenge.goals??[challenge.goal]).map(id=>nodeIndex.get(id));
 const wirings=sets.map(ids=>{
  const selected=new Set(ids),outgoing=challenge.nodes.map(()=>[]),paths=challenge.nodes.map(()=>0);paths[source]=1;
  for(const e of edges)if(selected.has(challenge.candidates[e.index].id))outgoing[e.from].push(e);
  for(const at of order)if(challenge.nodes[at].kind!=='goal')for(const e of outgoing[at])paths[e.to]+=paths[at];
  const toGoal=challenge.nodes.map((n,i)=>goals.includes(i));
  for(const at of [...order].reverse())if(challenge.nodes[at].kind!=='goal')for(const e of outgoing[at])toGoal[at]||=toGoal[e.to];
  const useful=edges.filter(e=>selected.has(challenge.candidates[e.index].id)).every(e=>paths[e.from]>0&&toGoal[e.to]);
  const branches=challenge.nodes.filter((n,i)=>n.kind==='prism'&&paths[i]>0&&outgoing[i].length>1).length;
  const viable=challenge.type==='interval'?paths[goals[0]]===challenge.count:goals.every(i=>paths[i]>0);
  let essential=true;
  if(challenge.type!=='interval'&&viable&&useful&&ids.length===challenge.limit)for(const omitted of ids){
   const reached=challenge.nodes.map(()=>false);reached[source]=true;
   for(const at of order)if(reached[at]&&challenge.nodes[at].kind!=='goal')for(const e of outgoing[at])if(challenge.candidates[e.index].id!==omitted)reached[e.to]=true;
   if(goals.every(i=>reached[i])){essential=false;break;}
  }
  return {ids,outgoing,branches,viable,useful,essential};
 });
 const eligible=wirings.filter(w=>w.viable);
 const desired=eligible.filter(w=>w.useful&&w.essential&&w.ids.length===challenge.limit&&w.branches>=(['Q9','Q10'].includes(challenge.id)?2:1));
 return {challenge,source,order,goals,edges,sets,wirings,eligible,desired,processing:challenge.nodes.map(n=>ticks(n.process))};
}

export function runBalancedClock(compiled,values,wiring){
 const arrivals=compiled.challenge.nodes.map(()=>[]),terminal=new Map();let end=0,waiting=false;
 for(const at of compiled.order){
  const node=compiled.challenge.nodes[at];
  if(node.kind==='goal')continue;
  const received=at===compiled.source?[0]:arrivals[at];received.sort((a,b)=>a-b);
  let ready=0;
  for(const arrived of received){
   const start=Math.max(ready,arrived);waiting||=start>arrived;
   const finish=at===compiled.source?0:start+compiled.processing[at];ready=finish;end=Math.max(end,finish);
   for(const edge of wiring.outgoing[at]){
    const due=finish+values[edge.index];arrivals[edge.to].push(due);end=Math.max(end,due);
    if(compiled.challenge.nodes[edge.to].kind==='goal'){
     if(!terminal.has(edge.index))terminal.set(edge.index,[]);
     terminal.get(edge.index).push(due);
    }
   }
  }
 }
 for(const goal of compiled.goals)arrivals[goal].sort((a,b)=>a-b);
 return {arrivals,terminal,end,waiting};
}

function achievedAt(compiled,run){
 const c=compiled.challenge;
 if(c.type==='interval'){
  const times=run.arrivals[compiled.goals[0]],gap=ticks(c.interval);
  return times.length===c.count&&times.every((at,i)=>i===0||at-times[i-1]===gap)?times[0]:null;
 }
 const first=compiled.goals.map(i=>run.arrivals[i][0]);
 if(first.some(t=>t===undefined))return null;
 if(c.type==='delivery-all')return Math.max(...first);
 for(let i=1;i<first.length;i++){
  if(first[i]<=first[i-1])return null;
  if(c.intervals&&first[i]-first[i-1]!==ticks(c.intervals[i-1]))return null;
 }
 return first.at(-1);
}

export function inspectBalancedClock(compiled,values,{maximum=false}={}){
 let best=Infinity,winners=0,achieved=0,purposeFailures=0,end=0,winner=[];const outcomes=new Map();
 for(const wiring of maximum?compiled.wirings:compiled.eligible){
  const run=runBalancedClock(compiled,values,wiring);end=Math.max(end,run.end);
  if(!wiring.viable)continue;
  const at=achievedAt(compiled,run);if(at===null)continue;
  achieved++;
  if(!wiring.branches||(['Q9','Q10'].includes(compiled.challenge.id)&&wiring.branches<2)||(['Q11','Q12'].includes(compiled.challenge.id)&&!run.waiting))purposeFailures++;
  if(!outcomes.has(at))outcomes.set(at,wiring.ids);
  if(at<best){best=at;winners=1;winner=wiring.ids;}else if(at===best)winners++;
 }
 const next=[...outcomes.keys()].sort((a,b)=>a-b).find(at=>at>best);
 const traps=compiled.challenge.candidates.filter((e,i)=>!winner.includes(e.id)&&compiled.challenge.candidates.some((w,j)=>winner.includes(w.id)&&w.from===e.from&&values[i]<values[j])).map(e=>e.id);
 return {baseline:best===Infinity?null:seconds(best),maxDuration:seconds(end),winners,achieved,purposeFailures,winner,traps,partial:next===undefined?null:{time:seconds(next),edges:outcomes.get(next)},valid:winners===1&&next!==undefined&&purposeFailures===0};
}

function shuffled(items,random){return items.map(value=>({value,key:random()})).sort((a,b)=>a.key-b.key).map(row=>row.value);}

function propose(compiled,random,attempt){
 const c=compiled.challenge;
 // A merge with one-second service needs a deliberately early path, a second
 // path in its first waiting window and a third in the next window. Its local
 // shortcut remains tempting, but moves the second arrival out of that window.
 const mergeAnchor={SA:.5,AB:1.5,BF:1,AC:.1,CF:.5,AD:4,ED:.3,EF:4,FG:.1,AF:4,AE:.5,BC:.8,DF:.3};
 if(c.id==='Q12'&&attempt<=2&&c.candidates.every(e=>Object.hasOwn(mergeAnchor,e.id))){
  const reflected={S:'S',A:'A',B:'E',E:'B',C:'D',D:'C',F:'F',G:'G'};
  return c.candidates.map(e=>ticks(mergeAnchor[attempt===1?e.id:reflected[e.from]+reflected[e.to]]));
 }
 // Small positive durations keep alternatives brisk. Difficulty comes from
 // competing routes/queueing, never from adding a long artificial delay.
 let values=c.candidates.map(()=>10+Math.floor(random()*(c.type==='interval'?24:12))*10);
 const sourceEdges=compiled.edges.filter(e=>e.from===compiled.source);
 if(sourceEdges.length===1)values[sourceEdges[0].index]=50;
 const desired=compiled.desired;
 if(!desired.length)throw Error(c.id+': no full-budget reachable wiring for the existing objective');
 const wiring=desired[Math.floor(random()*desired.length)];
 if(c.type!=='interval'&&c.id!=='Q8'){
  const selected=new Set(wiring.ids);
  values=c.candidates.map(edge=>selected.has(edge.id)?10+Math.floor(random()*12)*10:c.id==='Q25'?100+Math.floor(random()*11)*10:150+Math.floor(random()*21)*10);
  if(sourceEdges.length===1)values[sourceEdges[0].index]=50;
 }
 const run=runBalancedClock(compiled,values,wiring);
 if(c.type==='interval'){
  const groups=[...run.terminal].filter(([edge])=>compiled.edges[edge].to===compiled.goals[0]);
  const gap=ticks(c.interval);let offset=0;const shifts=new Map();
  for(const [edge,times]of shuffled(groups,random)){
   times.sort((a,b)=>a-b);
   // Several arrivals through the same final edge can only be translated
   // together. Queueing at a merge must already give their exact spacing.
   if(times.some((at,i)=>i>0&&at-times[i-1]!==gap))return null;
   shifts.set(edge,offset-times[0]);offset+=times.length*gap;
  }
  if(!groups.length)return null;
  const base=Math.max(...[...shifts].map(([edge,shift])=>10-values[edge]-shift));
  values=values.map((value,i)=>shifts.has(i)?value+shifts.get(i)+base:value);
 }else if(c.type==='bell-sequence'&&c.intervals){
  const offsets=[0];for(const gap of c.intervals)offsets.push(offsets.at(-1)+ticks(gap));
  const shifts=new Map(compiled.goals.map((goal,i)=>[goal,offsets[i]-run.arrivals[goal][0]]));
  const terminal=compiled.edges.filter(e=>shifts.has(e.to));
  const base=Math.max(...terminal.map(e=>10-values[e.index]-shifts.get(e.to)));
  values=values.map((value,i)=>shifts.has(compiled.edges[i].to)?value+shifts.get(compiled.edges[i].to)+base:value);
 }
 // Occasionally retain authored values as a cheap deterministic anchor.
 if(attempt===1)values=c.candidates.map(e=>ticks(e.time));
 return values.every(value=>value>=10&&value<=600)?values:null;
}

function materialize(authored,values){return {...authored,candidates:authored.candidates.map((edge,i)=>({...edge,time:seconds(values[i])}))};}

function verify(compiled,values){
 const problem=materialize(compiled.challenge,values),quick=inspectBalancedClock(compiled,values,{maximum:true}),result=inspectProblem(problem,compiled.sets);
 for(const field of ['baseline','maxDuration','winners','achieved','purposeFailures','valid'])if(quick[field]!==result[field])throw Error('Proposal clock disagrees with canonical validator at '+problem.id+' '+field+': '+JSON.stringify([quick[field],result[field]]));
 if(signature(quick.winner)!==signature(result.winner)||quick.partial?.time!==result.partial?.time||signature(quick.traps)!==signature(result.traps))throw Error('Proposal answers disagree with canonical validator '+problem.id);
 return {problem,result};
}

export function generateBalancedStage(authored,oldBank,{maxAttempts=80000,budgetMs=60000,log=console.log}={}){
 const compiled=compileBalancedGraph(authored),random=stream(authored.id),families=[],seen=new Set(),start=Date.now();
 const oldMaximum=Math.max(...oldBank.map(v=>Number(v.maxDuration)));
 // A revision may be structurally harder, but the slowest old run is a ceiling.
 const maximum=oldMaximum;
 log(`${authored.id} bounded search: ${compiled.sets.length} legal wirings, ${compiled.eligible.length} reachable objective wirings, previous maximum ${maximum}s`);
 let attempts=0,lastLog=start;
 while(families.length<2&&attempts<maxAttempts&&Date.now()-start<budgetMs){
  attempts++;
  if(Date.now()-lastLog>3000){log(`${authored.id} search=${attempts} families=${families.length} elapsed=${Date.now()-start}ms`);lastLog=Date.now();}
  const values=propose(compiled,random,attempts);if(!values)continue;
  const startEdges=compiled.edges.filter(e=>e.from===compiled.source);
  if(startEdges.length===1)values[startEdges[0].index]=20;
  const key=values.join(',');if(seen.has(key))continue;seen.add(key);
  const quick=inspectBalancedClock(compiled,values);
  if(attempts<=2){
   log(`${authored.id} anchor ${attempts}: ${JSON.stringify(quick)}`);
   if(quick.winners>1&&quick.winners<5)log('Tied seeds: '+JSON.stringify(compiled.eligible.filter(w=>achievedAt(compiled,runBalancedClock(compiled,values,w))===ticks(quick.baseline)).map(w=>w.ids)));
  }
  if(!quick.valid||(['Q8','Q9','Q10','Q11','Q12'].includes(authored.id)&&!quick.traps.length)||families.some(f=>signature(f.result.winner)===signature(quick.winner)))continue;
  const complete=inspectBalancedClock(compiled,values,{maximum:true});
  if(ticks(complete.maxDuration)+30>ticks(maximum))continue;
  log(`${authored.id} canonical proof candidate attempt=${attempts} baseline=${quick.baseline}`);
  const checked=verify(compiled,values);
  if(!checked.result.valid||ticks(checked.result.maxDuration)+30>ticks(maximum)){log(`${authored.id} candidate exceeds retained duration ceiling: ${checked.result.maxDuration}s`);continue;}
  families.push({...checked,values,attempt:attempts});log(`${authored.id} accepted family=${families.length} attempt=${attempts} baseline=${checked.result.baseline} max=${checked.result.maxDuration}`);
 }
 if(families.length!==2)throw Error(`${authored.id}: bounded seed search found ${families.length}/2 distinct families (${attempts} proposals, ${Date.now()-start} ms). No files were written.`);
 const bank=[],rows=[];
 for(let family=0;family<2;family++)for(let variant=0;variant<4;variant++){
  const seed=families[family],values=[...seed.values],sourceEdges=compiled.edges.filter(e=>e.from===compiled.source);
  if(sourceEdges.length!==1)throw Error('Four translated variants require exactly one common source edge '+authored.id);
  values[sourceEdges[0].index]+=variant*10;
  const {problem,result}=variant===0?seed:verify(compiled,values);
  if(!result.valid||signature(result.winner)!==signature(seed.result.winner)||Number(result.maxDuration)>maximum)throw Error('Translated draw failed full verification '+authored.id);
  const identity={id:authored.id,version:authored.version,type:authored.type,nodes:authored.nodes,candidates:problem.candidates,limit:authored.limit,goal:authored.goal,goals:authored.goals,interval:authored.interval,count:authored.count,intervals:authored.intervals};
  const id=createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,16);
  bank.push({id,baseVersion:authored.version,family,times:problem.candidates.map(e=>e.time),baseline:result.baseline,maxDuration:result.maxDuration});
  rows.push({challenge:authored.id,id,family,variant,attempt:seed.attempt,legalWirings:compiled.sets.length,...result});
  log(`${authored.id} verified family=${family} variant=${variant} max=${result.maxDuration}`);
 }
 if(new Set(bank.map(v=>v.id)).size!==8)throw Error('Duplicate generated draw IDs '+authored.id);
 return {bank,rows};
}

export function generateBalancedChallenges({ids=null,maxAttempts,budgetMs,dryRun=false}={}){
 const targets=challenges.filter(c=>c.balanceRevision===true&&Number(c.id.slice(1))>=7&&Number(c.id.slice(1))<=28&&(!ids||ids.includes(c.id)));
 if(ids?.some(id=>!targets.some(c=>c.id===id)))throw Error('--ids must name only regular practice stages with balanceRevision:true');
 if(!targets.length)throw Error('No balanceRevision:true practice stages selected');
 const oldProof=JSON.parse(readFileSync(proofPath,'utf8')),banks=structuredClone(randomVariants),replacements=new Map();
 for(const authored of targets){
  if(!banks[authored.id]?.length||!baselineBanks[authored.id]?.length)throw Error('Missing original practice bank '+authored.id);
  const generated=generateBalancedStage(authored,baselineBanks[authored.id],{maxAttempts,budgetMs});banks[authored.id]=generated.bank;replacements.set(authored.id,generated.rows);
 }
 const emitted=new Set(),rows=[];
 for(const row of oldProof.stages){
  if(!replacements.has(row.challenge)){rows.push(row);continue;}
  if(!emitted.has(row.challenge)){rows.push(...replacements.get(row.challenge));emitted.add(row.challenge);}
 }
 for(const [id,replacement]of replacements)if(!emitted.has(id))rows.push(...replacement);
 const proof={...oldProof,stages:rows};
 for(const id of Object.keys(randomVariants))if(!replacements.has(id)&&JSON.stringify(banks[id])!==JSON.stringify(randomVariants[id]))throw Error('Unrelated bank changed '+id);
 if(JSON.stringify(rows.filter(r=>!replacements.has(r.challenge)))!==JSON.stringify(oldProof.stages.filter(r=>!replacements.has(r.challenge))))throw Error('Unrelated proof rows changed');
 if(!dryRun){
  const previous=readFileSync(bankPath,'utf8'),assignment=previous.indexOf('export const randomVariants = ');
  if(assignment<0)throw Error('Unknown bank source format');
  writeFileSync(bankPath,previous.slice(0,assignment)+'export const randomVariants = '+JSON.stringify(banks,null,2)+';\n');
  writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n');
 }
 console.log(`${dryRun?'Verified without writing':'Generated'} ${targets.length} balanced stages / ${targets.length*8} draws; other banks and proof rows retained.`);
 return {banks,proof};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=name=>{const at=args.indexOf(name);return at<0?undefined:args[at+1];};
 const positive=(name,fallback)=>{const raw=value(name);if(raw===undefined)return fallback;const number=Number(raw);if(!Number.isSafeInteger(number)||number<=0)throw Error(name+' requires a positive integer');return number;};
 const known=new Set(['--ids','--max-attempts','--budget-ms','--dry-run']);
 for(let i=0;i<args.length;i++){
  if(!known.has(args[i]))throw Error('Unknown argument '+args[i]);
  if(args[i]!=='--dry-run'){
   if(i+1>=args.length||args[i+1].startsWith('--'))throw Error('Missing value for '+args[i]);
   i++;
  }
 }
 generateBalancedChallenges({ids:value('--ids')?.split(','),maxAttempts:positive('--max-attempts',80000),budgetMs:positive('--budget-ms',60000),dryRun:args.includes('--dry-run')});
}
