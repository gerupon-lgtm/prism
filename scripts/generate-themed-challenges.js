import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {themedChallenges} from '../src/content/themed-challenges.js';
import {challenges} from '../src/content/challenges.js';
import {inspectProblem,legalWirings} from './random-challenge-validation.js';

// Offline only. All candidate subsets are simulated; shipping assets contain no solutions.
export function generateThemedChallenges(banks,proof){
 let state=0x20261018;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(const raw of themedChallenges){
  // Each stage has its own stream; rebuilding another cache cannot affect it.
  state=(0x20261018^Number(raw.id.slice(1)))>>>0;
  const authored=challenges.find(c=>c.id===raw.id),sets=legalWirings(authored),families=[];let attempts=0;
  const cachePath='設計検証/テーマ課題/seed-'+authored.id+'.json';
  const definition=c=>JSON.stringify({id:c.id,version:c.version,nodes:c.nodes.map(({id,kind,process})=>({id,kind,process})),candidates:c.candidates,limit:c.limit,type:c.type,goals:c.goals,goal:c.goal,interval:c.interval,count:c.count});
  if(!process.argv.includes('--search-seeds')&&existsSync(cachePath)){const cached=JSON.parse(readFileSync(cachePath));if(definition(cached.authored)===definition(authored)){for(const family of cached.families){const problem={...authored,candidates:family.problem.candidates},result=inspectProblem(problem,sets);if(result.valid)families.push({problem,result});}}}
  while(families.length<2&&attempts<300){
   attempts++;
   const times=authored.candidates.map((e,i)=>{
    if(authored.type==='interval'){
     const total=({BG:15,CG:25,DG:35,EG:45})[e.id];
     return String((total!==undefined?(attempts===1?total:70-total)-Math.round(Number(authored.candidates.find(a=>a.from==='A'&&a.to===e.from).time)*10):Math.round(Number(e.time)*10))/10);
    }
    return String((i===0?5:attempts===1?Math.round(Number(e.time)*10):attempts>25?1+Math.floor(random()*40):Math.max(1,Math.round(Number(e.time)*10)+Math.floor(random()*25)-10))/10);
   });
   if(times.some(t=>Number(t)<=0))continue;
   const problem={...authored,candidates:authored.candidates.map((e,i)=>({...e,time:times[i]}))},result=inspectProblem(problem,sets);
   console.log(`${authored.id} search=${attempts} unique=${result.winners} partial=${Boolean(result.partial)} traps=${result.traps.length}`);
   if(!result.valid||families.some(f=>JSON.stringify(f.result.winner)===JSON.stringify(result.winner)))continue;
   families.push({problem,result});
  }
  if(families.length<2)throw new Error(authored.id+': two distinct verified solutions not found');
  mkdirSync('設計検証/テーマ課題',{recursive:true});writeFileSync(cachePath,JSON.stringify({authored,families},null,2));
  const bank=[];
  for(let family=0;family<2;family++)for(let variant=0;variant<4;variant++){
   const problem=structuredClone(families[family].problem);problem.candidates[0].time=String(.5+variant*.2);
   const result=inspectProblem(problem,sets);if(!result.valid)throw new Error('Generated draw failed: '+authored.id);
   const identity={id:problem.id,version:problem.version,candidates:problem.candidates,limit:problem.limit,interval:problem.interval,count:problem.count};
   const id=createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,16);
   bank.push({id,baseVersion:authored.version,family,times:problem.candidates.map(e=>e.time),baseline:result.baseline,maxDuration:result.maxDuration});
   proof.stages.push({challenge:authored.id,id,family,attempt:attempts,legalWirings:sets.length,...result});
  }
  banks[authored.id]=bank;console.log(`${authored.id}: ${bank.length} exhaustively verified draws, two perfect-wiring families`);
 }
}
