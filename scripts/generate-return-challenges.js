// Classify all permitted wirings at the real first-N or definitive failure.
// A slow valid clear rejects the problem, never the individual run.
import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {returnChallenges} from '../src/content/return-challenges.js';
import {Simulation} from '../src/core/simulation.js';
import {returnPatternResult,returnPatternDeadline} from '../src/core/return-pattern.js';
export const returnTempo={maximumWire:2.5,maximumClearFirst:2.5,maximumRun:12};

export function returnWirings(challenge){
 const sets=[];
 for(let mask=0;mask<2**challenge.candidates.length;mask++){
  const ids=challenge.candidates.filter((_,i)=>mask&2**i).map(e=>e.id);
  if(ids.length<=challenge.limit)sets.push(ids);
 }
 return sets;
}
export function runReturn(challenge,ids){
 const run=new Simulation({mode:'spread',target:challenge.goal,nodes:challenge.nodes,edges:challenge.candidates.filter(e=>ids.includes(e.id))});
 let steps=0;
 while(returnPatternResult(challenge,run).state==='pending'){
  if(++steps>2000||run.records.length>12000)throw Error('Unresolved return wiring; reject rather than cut a possible clear: '+challenge.id+' '+ids.join(','));
  const deadline=returnPatternDeadline(challenge,run);
  if(deadline!==null&&(run.nextTime===null||deadline<run.nextTime))run.advanceUntil(run.circuit.time.format(deadline));
  else if(run.nextTime!==null)run.advanceNext();
  else throw Error('Pending return without an event or exact deadline '+challenge.id);
 }
 return run;
}
export function inspectReturn(challenge,sets=returnWirings(challenge)){
 const clears=[];let maximum=0,failed=0,failedMaximum=0,firstBellMaximum=0,failedExample=null;
 for(const ids of sets){
  const run=runReturn(challenge,ids),outcome=returnPatternResult(challenge,run);
  const ended=Number(run.format());maximum=Math.max(maximum,ended);
  if(outcome.first!==null)firstBellMaximum=Math.max(firstBellMaximum,Number(outcome.first));
  if(outcome.state==='achieved')clears.push({time:outcome.actual,first:outcome.first,edges:ids,waited:run.records.some(e=>e.type==='process-start'&&Number(e.wait)>0)});
  else if(outcome.state==='failed'){
   failed++;if(failedExample===null||ended>failedMaximum){failedMaximum=ended;failedExample={time:run.format(),edges:ids,reason:outcome.reason};}
  }else throw Error('Return wiring was not classified '+challenge.id+' '+outcome.state);
 }
 clears.sort((a,b)=>Number(a.time)-Number(b.time));
 const best=clears[0],winners=best?clears.filter(e=>e.time===best.time).length:0;
 const partial=clears.find(e=>Number(e.time)>Number(best?.time))??null;
 const clearFirstMaximum=clears.length?Math.max(...clears.map(e=>Number(e.first))):null,clearMaximum=clears.length?Math.max(...clears.map(e=>Number(e.time))):null;
 const clearBudget=returnTempo.maximumClearFirst+(challenge.count-1)*Number(challenge.interval);
 const valid=winners===1&&Boolean(partial)&&best.edges.length===challenge.limit&&clearFirstMaximum<=returnTempo.maximumClearFirst&&clearMaximum<=clearBudget&&maximum<=returnTempo.maximumRun&&challenge.candidates.every(e=>Number(e.time)<=returnTempo.maximumWire);
 return {legalWirings:sets.length,achieved:clears.length,failed,winners,winner:best?.edges??[],baseline:best?.time??null,partial,waited:best?.waited??false,maximum,firstBellMaximum,clearFirstMaximum,clearMaximum,clearBudget,failedMaximum,failedExample,clears,valid};
}
const decimal=value=>String(Math.round(value*100)/100);
const mirrorEdge={SA:'SB',SB:'SA',AC:'BD',BD:'AC',CS:'DS',DS:'CS',AG:'BG',BG:'AG',SC:'SD',SD:'SC',CG:'DG',DG:'CG',AD:'BC',BC:'AD'};
const unfilteredCandidateIds=['SA','AC','CS','SB','BD','DS','AG','BG','SC','CG','SD','DG','AD','BC'];
const wiringCount=(n,limit)=>{let term=1,total=1;for(let k=1;k<=Math.min(n,limit);k++){term=term*(n-k+1)/k;total+=term;}return total;};
export function returnFamilyProblem(authored,{family=0,variant=0,attempt=0}={}){
 const problem=structuredClone(authored),fast=decimal(.1+variant*.1);
 const add=(a,b)=>Number(decimal(Number(a)+b));
 // Different winning structures, with readable tenths. Quarter seconds are
 // retained only where the existing processing and exact period require them.
 const patterns={
  Q29:{SA:.5,AC:.5,CS:.5,SB:.5,BD:.5,DS:.7,AG:add(fast,.2),BG:Number(fast),SC:.4,CG:.3,SD:.6,DG:.6,AD:1,BC:1.2},
  Q30:{SA:.2,AC:.4,CS:1,SB:.5,BD:.6,DS:.6,AG:1.2,BG:.8,SC:.75,CG:.8,SD:.8,DG:Number(fast),AD:.2,BC:.4},
  Q31:{SA:.3,AC:.4,CS:.5,SB:.2,BD:.3,DS:.6,AG:.8,BG:Number(fast),SC:.7,CG:.6,SD:.5,DG:.4,AD:.6,BC:.4},
  Q32:{SA:.25,AC:.25,CS:.5,SB:.25,BD:.25,DS:.7,AG:Number(fast),BG:add(fast,1),SC:.6,CG:add(fast,1.5),SD:.8,DG:.6,AD:.6,BC:.8},
  Q33:{SA:.2,AC:.2,CS:.2,SB:.2,BD:.2,DS:.2,AG:.7,BG:.9,SC:2,CG:add(fast,.1),SD:2,DG:Number(fast),AD:.2,BC:.2},
  Q34:{SA:.1,AC:.1,CS:1.8,SB:.1,BD:.2,DS:1.5,AG:Number(fast),BG:add(fast,1),SC:2.2,CG:add(fast,1.4),SD:.5,DG:add(fast,2.1),AD:.7,BC:.4},
 };
 const values=patterns[problem.id];if(!values)throw Error('No authored return structure '+problem.id);
 const mutable={Q29:['SC','SD','DG','AD','BC','DS'],Q30:['SB','BG','AG','AC','BD','DS','SD','BC','CG'],Q31:['SC','CS','AC','BD','SD','CG','DG','AG','BC'],Q32:['SC','SD','DG','AD','BC','DS','BD'],Q33:['AG','BG'],Q34:['AD','BD','SC']}[problem.id];
 const choices=[.2,.4,.6,.8,1,1.2];
 if(attempt)for(let i=0;i<mutable.length;i++)values[mutable[i]]=choices[(attempt*(i+3)+i+Number(problem.id.slice(1)))%choices.length];
 for(const e of problem.candidates)if(values[e.id]===undefined||!problem.candidates.some(f=>f.id===mirrorEdge[e.id]))throw Error('Return subset must retain authored IDs and reflection pairs '+problem.id+' '+e.id);
 problem.candidates=problem.candidates.map(e=>({...e,time:decimal(values[family?mirrorEdge[e.id]:e.id])}));return problem;
}
const targetWinner={Q29:['SA','AC','CS','SB','BG'],Q30:['SC','CS','SA','AD','DG'],Q31:['SA','AD','DS','SB','BG'],Q32:['SA','AC','CS','SB','AG','BG'],Q33:['SA','AD','SB','BD','DS','DG'],Q34:['SA','AC','CS','AG','SB','BG','CG']};
const sameEdges=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const intendedWinner=(id,family)=>targetWinner[id].map(id=>family?mirrorEdge[id]:id);
const stageIntent={Q29:'導入：三辺の基本循環と別の鐘枝',Q30:'組合せ：二辺の帰還短絡と二段の鐘経路',Q31:'手応え：交差する帰還と別の鐘枝',Q32:'短い解放：一循環と二出口の交互四音',Q33:'応用：二経路が処理待ちへ合流して五音',Q34:'締め：三出口と三秒周期で交互の六音'};
export function prototypeReturn(id='Q29'){
 if(id==='all')return returnChallenges.map(c=>prototypeReturn(c.id));
 const authored=returnChallenges.find(c=>c.id===id);if(!authored)throw Error('Unknown return challenge '+id);
 const sets=returnWirings(authored),rows=[];
 for(let family=0;family<1;family++){const problem=returnFamilyProblem(authored,{family}),started=performance.now(),result=inspectReturn(problem,sets);rows.push({family,seconds:(performance.now()-started)/1000,...result});}
 console.log(JSON.stringify({prototype:id,rows:rows.map(({clears,failedExample,...r})=>({...r,winnerMatchesIntention:sameEdges(r.winner,intendedWinner(id,r.family)),bestClears:clears.filter(c=>c.time===r.baseline),slowestClear:clears.at(-1)}))}));return rows;
}
export function generateReturnChallenges(){
 const banks={},proof={kind:'first-N-return-pattern',tempo:returnTempo,classification:'all legal wirings of the retained candidate subset; actual first-N or exact definitive-failure boundary; no authored runtime cutoff',candidateReduction:'retain both winning families and the minimal reflected pair needed for partial clears; no replacement choices added',stages:[]};
 for(const authored of returnChallenges){
  const sets=returnWirings(authored),bank=[],families=[];let accepted=null;
  for(let attempt=0;attempt<40;attempt++){
   const problem=returnFamilyProblem(authored,{attempt}),result=inspectReturn(problem,sets);
   console.log(authored.id+' seed '+attempt+' valid='+result.valid+' clears='+result.achieved+' first='+result.clearFirstMaximum+' clear='+result.clearMaximum+' failed='+result.failedMaximum);
   if(result.valid&&sameEdges(result.winner,intendedWinner(authored.id,0))){accepted=attempt;break;}
  }
  if(accepted===null)throw Error('Return needs a brisk unique seed '+authored.id);
  for(let family=0;family<2;family++)for(let variant=0;variant<4;variant++){
   const problem=returnFamilyProblem(authored,{family,variant,attempt:accepted}),result=inspectReturn(problem,sets);
   console.log(authored.id+' family '+family+' variant '+variant+' winners='+result.winners+' clears='+result.achieved+' first='+result.clearFirstMaximum+' clear='+result.clearMaximum+' failed='+result.failedMaximum);
   if(!result.valid||!sameEdges(result.winner,intendedWinner(authored.id,family)))throw Error('Return problem needs revision '+JSON.stringify(result));
   if(variant===0)families.push(result.winner);
   const id=createHash('sha256').update(JSON.stringify({id:problem.id,version:problem.version,nodes:problem.nodes,candidates:problem.candidates,count:problem.count,interval:problem.interval,limit:problem.limit})).digest('hex').slice(0,16);
   // Every selected circuit supports at least tenths, even if the complete
   // candidate bank uses hundredths. Round UP so its limit represents all runs.
   bank.push({id,baseVersion:authored.version,family,times:problem.candidates.map(e=>e.time),baseline:result.baseline,maxDuration:decimal(Math.ceil(result.maximum*10)/10)});
   proof.stages.push({challenge:authored.id,id,family,variant,intent:stageIntent[authored.id],intendedWinner:intendedWinner(authored.id,family),candidateIds:problem.candidates.map(e=>e.id),priorUnfilteredCandidateCount:unfilteredCandidateIds.length,priorUnfilteredLegalWirings:wiringCount(unfilteredCandidateIds.length,authored.limit),removedCandidates:unfilteredCandidateIds.filter(id=>!problem.candidates.some(e=>e.id===id)),...result});
  }
  if(JSON.stringify(families[0])===JSON.stringify(families[1]))throw Error('Same return-wiring families '+authored.id);
  banks[authored.id]=bank;
 }
 mkdirSync('設計検証/星への帰還',{recursive:true});
 writeFileSync('src/content/return-variants.js','// Generated by scripts/generate-return-challenges.js. Answers stay in proof artifacts.\nexport const returnVariants = '+JSON.stringify(banks,null,2)+';\n');
 writeFileSync('設計検証/星への帰還/proof.json',JSON.stringify(proof,null,2));
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/generate-return-challenges.js')){
 if(process.argv[2]==='--prototype')prototypeReturn(process.argv[3]);else generateReturnChallenges();
}
