import {readFileSync,writeFileSync} from 'node:fs';
import {challenges} from '../src/content/challenges.js';
import {randomVariants as bank} from '../src/content/random-variants.js';
const base=JSON.parse(readFileSync('tests/fixtures/pre-balanced-0.87.json'));
const proof=JSON.parse(readFileSync('設計検証/ランダム課題/generation.json'));
const rows=challenges.filter(c=>c.balanceRevision).map(c=>({stage:c.number,id:c.id,version:c.version,candidates:c.candidates.length,oldCandidates:base.challenges.find(a=>a.id===c.id).candidates.length,perfectMin:Math.min(...bank[c.id].map(v=>+v.baseline)),perfectMax:Math.max(...bank[c.id].map(v=>+v.baseline)),max:Math.max(...bank[c.id].map(v=>+v.maxDuration)),oldMax:Math.max(...base.banks[c.id].map(v=>+v.maxDuration)),minTraps:Math.min(...proof.stages.filter(p=>p.challenge===c.id).map(p=>p.traps.length))}));
writeFileSync('設計検証/対称配置実装-20261023/content-summary.json',JSON.stringify(rows,null,2)+'\n');console.log(rows);
