// Bounded offline selection of short, plausible alternatives. Every shipped draw
// is still checked by the canonical Simulation over ALL permitted wirings.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {challenges} from '../src/content/challenges.js';
import {randomVariants} from '../src/content/random-variants.js';
import {compileBalancedGraph,runBalancedClock,inspectBalancedClock} from './generate-balanced-challenges.js';
import {inspectProblem} from './random-challenge-validation.js';
import {stagePacing,perfectFinish} from './stage-pacing-policy.js';
const old=JSON.parse(readFileSync(new URL('../tests/fixtures/pre-brisk-0.88.json',import.meta.url),'utf8'));
function writeAtomic(file,text){const temp=file+'.next';writeFileSync(temp,text);for(let attempt=0;;attempt++){try{renameSync(temp,file);return;}catch(e){if(attempt>=4||!['UNKNOWN','EBUSY','EPERM','EACCES'].includes(e.code))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}}}
const ticks=s=>Math.round(Number(s)*100),str=n=>String(Math.round(n)/100),key=ids=>[...ids].sort().join(',');
function rng(id){let s=(0x20261024^Number(id.slice(1)))>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const pick=(a,r)=>a[Math.floor(r()*a.length)];
function shuffled(a,r){return a.map(v=>({v,t:r()})).sort((x,y)=>x.t-y.t).map(x=>x.v);}
export function reweightSeed(g,variant){
 const c=g.challenge,wireCap=ticks(stagePacing(c).maxLeg),n=c.nodes.length,constraints=[],distance=Array(n).fill(0);
 for(const e of g.edges){const t=ticks(variant.times[e.index]),lo=e.from===g.source?20:10,hi=e.from===g.source?20:wireCap;constraints.push({u:e.from,v:e.to,w:hi-t},{u:e.to,v:e.from,w:t-lo});}
 for(const goal of g.goals.slice(1)){constraints.push({u:g.goals[0],v:goal,w:0},{u:goal,v:g.goals[0],w:0});}
 for(let pass=0;pass<n;pass++){let changed=false;for(const e of constraints)if(distance[e.v]>distance[e.u]+e.w){distance[e.v]=distance[e.u]+e.w;changed=true;}if(!changed)break;if(pass===n-1)return null;}
 return g.edges.map(e=>ticks(variant.times[e.index])+distance[e.to]-distance[e.from]);
}
// A local linear model proposes values preserving two old successful patterns.
// It never proves a draw: changed queue order and every other wiring are checked
// again by the complete canonical simulation.
function linearRun(g,values,ids){
 const selected=new Set(ids),incoming=g.challenge.nodes.map(()=>[]),goals=new Map(),zero=()=>({at:0,k:0,a:Array(values.length).fill(0)});
 for(const at of g.order){
  const node=g.challenge.nodes[at],rows=at===g.source?[zero()]:incoming[at].sort((a,b)=>a.at-b.at);
  if(node.kind==='goal'){goals.set(at,rows);continue;}
  let ready=zero();
  for(const row of rows){
   const start=at===g.source?zero():row.at>=ready.at?row:ready,process=at===g.source?0:g.processing[at];
   const finish={at:start.at+process,k:start.k+process,a:[...start.a]};ready=finish;
   for(const edge of g.edges.filter(e=>e.from===at&&selected.has(g.challenge.candidates[e.index].id))){
    const a=[...finish.a];a[edge.index]++;incoming[edge.to].push({at:finish.at+values[edge.index],k:finish.k,a});
   }
  }
 }
 return goals;
}
function anchorSystems(g){
 const c=g.challenge,systems=[];
 for(const v of old.banks[c.id].filter((_,i)=>i%4===0)){
  const row=old.proof.regular.stages.find(r=>r.id===v.id),equations=[],values=v.times.map(ticks);
  for(const ids of [row.winner,row.partial.edges]){
   const out=linearRun(g,values,ids);
   const list=c.type==='interval'?out.get(g.goals[0]):g.goals.map(i=>out.get(i)[0]);
   const offsets=c.type==='interval'?list.map((_,i)=>i*ticks(c.interval)):[0,...(c.intervals??[]).map((_,i)=>c.intervals.slice(0,i+1).reduce((s,t)=>s+ticks(t),0))];
   if(c.type!=='interval'&&!c.intervals)continue;
   for(let i=1;i<list.length;i++)equations.push([...list[i].a.map((n,j)=>n-list[0].a[j]),offsets[i]-(list[i].k-list[0].k)]);
  }
  const source=Array(values.length+1).fill(0);source[g.edges.find(e=>e.from===g.source).index]=1;source[values.length]=20;equations.push(source);
  let rank=0;const pivots=[];
  for(let col=0;col<values.length;col++){
   const found=equations.findIndex((r,i)=>i>=rank&&Math.abs(r[col])>1e-8);if(found<0)continue;
   [equations[rank],equations[found]]=[equations[found],equations[rank]];
   const divisor=equations[rank][col];equations[rank]=equations[rank].map(n=>n/divisor);
   for(let i=0;i<equations.length;i++)if(i!==rank){const factor=equations[i][col];equations[i]=equations[i].map((n,j)=>n-factor*equations[rank][j]);}
   pivots.push(col);rank++;
  }
  if(equations.some(r=>r.slice(0,-1).every(n=>Math.abs(n)<1e-8)&&Math.abs(r.at(-1))>1e-8))continue;
  systems.push({equations:equations.slice(0,rank),pivots});
 }
 return systems;
}
function affineProposal(g,r){
 g.briskAnchors??=anchorSystems(g);if(!g.briskAnchors.length)return null;
 const system=pick(g.briskAnchors,r),values=g.edges.map(()=>pick([10,20,30,40,50,60,80,100,120,150,180,200,220,250],r)),pivot=new Set(system.pivots);
 for(let i=0;i<system.pivots.length;i++){const row=system.equations[i];values[system.pivots[i]]=row.at(-1)-row.slice(0,-1).reduce((s,n,j)=>s+(pivot.has(j)?0:n*values[j]),0);}
 return values.every(n=>Math.abs(n-Math.round(n/10)*10)<1e-6&&n>=10&&n<=ticks(stagePacing(g.challenge).maxLeg))?values.map(Math.round):null;
}
function mirroredValues(g,values){
 if(!values||g.challenge.type==='bell-sequence')return null;
 const nodes=g.challenge.nodes.map(n=>({...n,...g.challenge.displayPositions?.[n.id]})),map=new Map();
 for(const n of nodes){const m=nodes.find(m=>m.kind===n.kind&&Math.abs(m.x-(1-n.x))<1e-8&&Math.abs(m.y-n.y)<1e-8);if(!m)return null;map.set(n.id,m.id);}
 const times=g.challenge.candidates.map(e=>{const at=g.challenge.candidates.findIndex(o=>o.from===map.get(e.from)&&o.to===map.get(e.to));return at<0?null:values[at];});
 return times.includes(null)?null:times;
}

export function proposal(g,r,attempt){
 const c=g.challenge;
 if(attempt<old.banks[c.id].length){
  const v=old.banks[c.id][attempt];return v.times.map((t,i)=>c.candidates[i].from==='S'?20:Math.min(ticks(stagePacing(c).maxLeg),ticks(t)));
 }
 if(attempt<old.banks[c.id].length*2)return reweightSeed(g,old.banks[c.id][attempt-old.banks[c.id].length]);
 if(attempt<old.banks[c.id].length*3)return mirroredValues(g,reweightSeed(g,old.banks[c.id][attempt-old.banks[c.id].length*2]));
 if(attempt%2===0&&['interval','bell-sequence'].includes(c.type))return affineProposal(g,r);
 // Similar-sized edges keep routing choices plausible instead of marking every
 // losing choice with an obviously huge number.
 let values=c.candidates.map(()=>pick([10,20,30,40,50,60,80,100,120,150,180,200,250],r));
 const w=pick(g.desired,r);if(!w)throw Error(c.id+' no full-budget useful solution skeleton');
 for(let i=0;i<values.length;i++)if(w.ids.includes(c.candidates[i].id))values[i]=pick([10,20,30,40,50,60,80,100,120],r);
 const source=g.edges.filter(e=>e.from===g.source);
 if(source.length!==1)throw Error('Expected one common source edge '+c.id);
 values[source[0].index]=20;
 const run=runBalancedClock(g,values,w);
 if(c.type==='interval'){
  const groups=[...run.terminal].filter(([i])=>g.edges[i].to===g.goals[0]),gap=ticks(c.interval),shifts=new Map();let offset=0;
  for(const [edge,times]of shuffled(groups,r)){
   times.sort((a,b)=>a-b);
   if(times.some((t,i)=>i&&t-times[i-1]!==gap))return null;
   shifts.set(edge,offset-times[0]);offset+=times.length*gap;
  }
  if(!groups.length)return null;
  const base=Math.max(...[...shifts].map(([edge,shift])=>10-values[edge]-shift));
  values=values.map((t,i)=>shifts.has(i)?t+shifts.get(i)+base:t);
 }else if(c.type==='bell-sequence'&&c.intervals){
  const offsets=[0];for(const gap of c.intervals)offsets.push(offsets.at(-1)+ticks(gap));
  const shifts=new Map(g.goals.map((goal,i)=>[goal,offsets[i]-run.arrivals[goal][0]]));
  const terminal=g.edges.filter(e=>shifts.has(e.to)),base=Math.max(...terminal.map(e=>10-values[e.index]-shifts.get(e.to)));
  values=values.map((t,i)=>shifts.has(g.edges[i].to)?t+shifts.get(g.edges[i].to)+base:t);
 }
 return values.every(t=>t>=10&&t<=ticks(stagePacing(c).maxLeg))?values:null;
}
function acceptable(c,p,result){
 return result.valid&&result.traps.length>=p.minTraps&&perfectFinish(c,result.baseline)<=p.maxPerfectFinish-.3
  &&(!p.thinking||Number(result.partial.time)-Number(result.baseline)<=p.maxAlternativeGap)
  &&Number(result.maxDuration)<=p.maxRun-.3;
}
export function thinkingEvidence(g,values,result){
 const w=g.wirings.find(w=>key(w.ids)===key(result.winner));if(!w)throw Error('Winner missing');
 const run=runBalancedClock(g,values,w);
 return {branches:w.branches,waited:run.waiting,arrivals:g.goals.map(i=>({goal:g.challenge.nodes[i].id,count:run.arrivals[i].length})),prisms:g.challenge.nodes.filter((n,i)=>n.kind==='prism'&&run.arrivals[i].length).map(n=>n.id)};
}
function structural(g,values,result,p){const e=thinkingEvidence(g,values,result);return e.branches>=p.minBranches&&(!p.requiresWaiting||e.waited);}
function verify(g,values){
 const c={...g.challenge,candidates:g.challenge.candidates.map((e,i)=>({...e,time:str(values[i])}))};
 const result=inspectProblem(c,g.sets),quick=inspectBalancedClock(g,values,{maximum:true});
 for(const f of ['baseline','maxDuration','winners','achieved','purposeFailures','valid'])if(result[f]!==quick[f])throw Error(c.id+' canonical disagreement '+f);
 if(key(result.winner)!==key(quick.winner))throw Error(c.id+' winner disagreement');
 return {c,result};
}
export function generateBriskStage(c,{maxAttempts=12000,budgetMs=180000,log=console.log}={}){
 const g=compileBalancedGraph(c),p=stagePacing(c),r=rng(c.id),families=[],started=Date.now();let attempt=0,last=started;
 log(c.id+' '+p.role+': '+g.sets.length+' legal, '+g.eligible.length+' reachable; short comparable choices');
 while(families.length<2&&attempt<maxAttempts&&Date.now()-started<budgetMs){
  if(Date.now()-last>5000){log(c.id+' proposals='+attempt+' families='+families.length+' elapsed='+Math.round((Date.now()-started)/1000)+'s');last=Date.now();}
  const values=proposal(g,r,attempt++);if(!values)continue;
  const q=inspectBalancedClock(g,values);if(!acceptable(c,p,q)||!structural(g,values,q,p)||families.some(f=>key(f.result.winner)===key(q.winner)))continue;
  const complete=inspectBalancedClock(g,values,{maximum:true});if(Number(complete.maxDuration)>p.maxRun-.3)continue;
  const checked=verify(g,values);if(!acceptable(c,p,checked.result))continue;
  families.push({...checked,values,attempt});log(c.id+' accepted '+families.length+' first='+checked.result.baseline+' max='+checked.result.maxDuration+' traps='+checked.result.traps.length);
  if(families.length===1){
   const reflected=mirroredValues(g,values);
   if(reflected){const rq=inspectBalancedClock(g,reflected,{maximum:true});
    if(acceptable(c,p,rq)&&structural(g,reflected,rq,p)&&key(rq.winner)!==key(checked.result.winner)){
     const opposite=verify(g,reflected);families.push({...opposite,values:reflected,attempt});log(c.id+' accepted mirrored family after full proof');
    }
   }
  }
 }
 if(families.length!==2)throw Error(c.id+' short-content search found '+families.length+'/2 families in '+attempt+' proposals; no files written for this stage');
 const bank=[],rows=[];
 for(const [family,seed]of families.entries())for(let variant=0;variant<4;variant++){
  const values=[...seed.values],source=g.edges.find(e=>e.from===g.source);values[source.index]+=variant*10;
  const {c:problem,result}=variant===0?seed:verify(g,values);
  if(!result.valid||Number(result.maxDuration)>p.maxRun||perfectFinish(c,result.baseline)>p.maxPerfectFinish||key(result.winner)!==key(seed.result.winner))throw Error(c.id+' translated draw failed pacing/proof');
  const id=createHash('sha256').update(JSON.stringify({id:c.id,version:c.version,type:c.type,nodes:c.nodes,candidates:problem.candidates,limit:c.limit,goal:c.goal,goals:c.goals,interval:c.interval,count:c.count,intervals:c.intervals})).digest('hex').slice(0,16);
  bank.push({id,baseVersion:c.version,family,times:problem.candidates.map(e=>e.time),baseline:result.baseline,maxDuration:result.maxDuration});
  rows.push({challenge:c.id,id,family,variant,attempt:seed.attempt,legalWirings:g.sets.length,role:p.role,thinkingEvidence:thinkingEvidence(g,values,result),...result});
  log(c.id+' verified '+family+'/'+variant+' max='+result.maxDuration);
 }
 return {bank,rows};
}
export function generateBriskChallenges({ids=null,...options}={}){
 const targets=challenges.slice(6,24).filter(c=>!ids||ids.includes(c.id));
 if(ids?.some(id=>!targets.some(c=>c.id===id)))throw Error('Only the ordinary18 stages can be generated here');
 const banks=structuredClone(randomVariants),proof=JSON.parse(readFileSync('設計検証/ランダム課題/generation.json','utf8'));
 // Checkpoint after each completely verified stage. Never publish an incomplete bank.
 for(const c of targets){
  const {bank,rows}=generateBriskStage(c,options);banks[c.id]=bank;
  const at=proof.stages.findIndex(row=>row.challenge===c.id);proof.stages=proof.stages.filter(row=>row.challenge!==c.id);proof.stages.splice(at<0?proof.stages.length:at,0,...rows);
  proof.method='Short plausible alternatives; all allowed wirings checked with canonical Simulation; success/failure pacing classified.';
  writeAtomic('src/content/random-variants.js','// Generated by scripts/generate-brisk-challenges.js; answers stay in proof artifacts.\nexport const randomVariants = '+JSON.stringify(banks,null,2)+';\n');
  writeAtomic('設計検証/ランダム課題/generation.json',JSON.stringify(proof,null,2)+'\n');
 }
 return {banks,proof};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const i=process.argv.indexOf('--ids');generateBriskChallenges({ids:i<0?null:process.argv[i+1].split(',')});
}
