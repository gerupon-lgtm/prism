// Build/test acceptance values, never runtime shortcuts.
import {readFileSync} from 'node:fs';
const old=JSON.parse(readFileSync(new URL('../tests/fixtures/pre-brisk-0.88.json',import.meta.url),'utf8'));
const wave=['discover','combine','think','release','apply','finale'];
export function perfectFinish(challenge,first){return Number(first)+(challenge.type==='interval'?(challenge.count-1)*Number(challenge.interval):0);}
export function stagePacing(challenge){
 const number=challenge.number??Number(challenge.id.slice(1)),role=wave[(number-7)%6]??'intro',thinking=['think','apply','finale'].includes(role);
 const prior=old.definitions.find(c=>c.id===challenge.id),bank=old.banks[challenge.id]??[prior];
 return {number,role,thinking,maxLeg:challenge.id==='Q10'?3.5:['Q9','Q12'].includes(challenge.id)?3:2.5,maxRun:Math.min(12,Math.max(...bank.map(v=>Number(v.maxDuration)))),
 maxPerfectFinish:Math.min(8.5,Math.max(...bank.map(v=>perfectFinish(prior,v.baseline)))),
 minTraps:thinking||['Q7','Q9'].includes(challenge.id)?1:0,maxAlternativeGap:thinking&&!['Q11','Q12'].includes(challenge.id)?1.2:Infinity,
 minBranches:thinking&&challenge.goals?.length===3?2:['Q9','Q10'].includes(challenge.id)?2:1,
 requiresWaiting:['Q11','Q12'].includes(challenge.id)};
}
