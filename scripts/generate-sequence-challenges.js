import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {sequenceChallenges} from '../src/content/sequence-challenges.js';
import {challenges} from '../src/content/challenges.js';
import {inspectProblem,legalWirings,simulateWiring} from './random-challenge-validation.js';
export function generateSequenceChallenges(banks,proof){
 for(const raw of sequenceChallenges){
  let state=(0x20261020^Number(raw.id.slice(1)))>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const authored=challenges.find(c=>c.id===raw.id),sets=legalWirings(authored),families=[],cache='設計検証/鐘の順番/seed-'+authored.id+'.json';
  const connected=sets.filter(ids=>{
   if(ids.length!==authored.limit)return false;
   const reached=new Set(['S']);let changed=true;
   while(changed){changed=false;for(const edge of authored.candidates)if(ids.includes(edge.id)&&reached.has(edge.from)&&!reached.has(edge.to)){reached.add(edge.to);changed=true;}}
   return authored.goals.every(id=>reached.has(id));
  });
  const definition=JSON.stringify(raw);let attempts=0;
  if(existsSync(cache)){const stored=JSON.parse(readFileSync(cache));if(stored.definition===definition)for(const family of stored.families){const problem={...authored,candidates:family.problem.candidates},result=inspectProblem(problem,sets);if(result.valid)families.push({problem,result});}}
  let alternatives=null;
  while(families.length<2&&attempts<200){
   attempts++;
   const times=authored.candidates.map((edge,i)=>i===0?'0.5':String(attempts===1?edge.time:(1+Math.floor(random()*16))*.5));
   let problem={...authored,candidates:authored.candidates.map((edge,i)=>({...edge,time:times[i]}))};
   if(families.length===1&&alternatives===null){
    alternatives=[];const family=families[0],original=simulateWiring(family.problem,family.result.winner);
    for(const selected of family.problem.candidates.filter(e=>family.result.winner.includes(e.id)&&authored.goals.includes(e.to)))for(const alternate of family.problem.candidates.filter(e=>e.to===selected.to&&!family.result.winner.includes(e.id))){
     const ids=family.result.winner.filter(id=>id!==selected.id).concat(alternate.id),trial=simulateWiring(family.problem,ids),oldAt=original.arrivals(selected.to)[0],newAt=trial.arrivals(selected.to)[0];if(!oldAt||!newAt)continue;
     const adjusted=Number(alternate.time)+Number(oldAt.time)-Number(newAt.time);if(adjusted<.1)continue;
     alternatives.push({...family.problem,candidates:family.problem.candidates.map(e=>e.id===alternate.id?{...e,time:String(Math.round(adjusted*10)/10)}:e.id===selected.id?{...e,time:String(Number(e.time)+.5)}:e)});
    }
   }
   if(alternatives?.length)problem=alternatives.shift();
   else if(attempts>1){
    const wiring=connected[Math.floor(random()*connected.length)],run=simulateWiring(problem,wiring),first=authored.goals.map(id=>Number(run.arrivals(id)[0].time)),offsets=[0];
    for(let i=1;i<first.length;i++)offsets.push(offsets[i-1]+Number(authored.intervals?.[i-1]??'1'));
    const shifts=Object.fromEntries(authored.goals.map((id,i)=>[id,offsets[i]-first[i]]));
    // Solve the proposed arrival differences at terminal edges, then prove all
    // other wirings too. This avoids blind searches for rare equal intervals.
    const base=Math.max(...problem.candidates.filter(e=>Object.hasOwn(shifts,e.to)).map(e=>.5-Number(e.time)-shifts[e.to]));
    problem={...problem,candidates:problem.candidates.map(e=>Object.hasOwn(shifts,e.to)?{...e,time:String(Math.round((Number(e.time)+shifts[e.to]+base)*10)/10)}:e)};
   }
   const result=inspectProblem(problem,sets);
   if(attempts===1||attempts%10===0)console.log(authored.id+' search '+attempts+' perfect='+result.winners+' clears='+result.achieved+' partial='+Boolean(result.partial));
   if(!result.valid||families.some(f=>JSON.stringify(f.result.winner)===JSON.stringify(result.winner)))continue;
   families.push({problem,result});console.log(authored.id+' accepted family '+families.length);
  }
  if(families.length<2)throw Error(authored.id+': two unique perfect-wiring families not found in bounded search');
  mkdirSync('設計検証/鐘の順番',{recursive:true});writeFileSync(cache,JSON.stringify({definition,families},null,2));
  const bank=[];
  for(let family=0;family<2;family++)for(let variant=0;variant<4;variant++){
   const problem=structuredClone(families[family].problem);problem.candidates[0].time=String(.5+variant*.2);
   const result=inspectProblem(problem,sets);if(!result.valid)throw Error('Invalid sequence draw '+authored.id);
   const identity={id:problem.id,version:problem.version,candidates:problem.candidates,limit:problem.limit,goals:problem.goals,intervals:problem.intervals,intervalTolerance:problem.intervalTolerance};
   const id=createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,16);
   bank.push({id,baseVersion:authored.version,family,times:problem.candidates.map(e=>e.time),baseline:result.baseline,maxDuration:result.maxDuration});
   proof.stages.push({challenge:authored.id,id,family,attempt:attempts,legalWirings:sets.length,...result});
  }
  banks[authored.id]=bank;console.log(authored.id+': 8 exhaustively verified draws, two distinct perfect wirings');
 }
}
