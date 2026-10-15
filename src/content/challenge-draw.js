import { randomVariants } from './random-variants.js';
import { RANDOM_CHALLENGE_REVISION } from '../core/challenge-identity.js';

export function drawChallenge(authored,{previousId=null,random=Math.random}={}){
  if(Number(authored.id.slice(1))<=6)return structuredClone(authored);
  const bank=randomVariants[authored.id];
  if(!bank?.length)throw new Error('この課題の検査済み出題がありません。');
  const choices=bank.length>1?bank.filter(item=>item.id!==previousId):bank;
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1)throw new Error('出題の抽選に失敗しました。');
  const selected=choices[Math.floor(value*choices.length)];
  if(selected.baseVersion!==authored.version||selected.times.length!==authored.candidates.length)throw new Error('出題と課題の版が一致しません。');
  const challenge=structuredClone(authored);
  challenge.candidates=challenge.candidates.map((edge,i)=>({...edge,time:selected.times[i]}));
  challenge.baseline=selected.baseline;challenge.maxDuration=selected.maxDuration;
  challenge.draw={id:selected.id,revision:RANDOM_CHALLENGE_REVISION,number:bank.indexOf(selected)+1};
  return challenge;
}
