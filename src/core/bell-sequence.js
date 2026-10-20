// First arrivals are compared on the simulation clock, never audio/wall time.
export function validateBellSequence(challenge,scale,availableGoals){
 const goals=challenge.goals;
 if(!Array.isArray(goals)||goals.length<2||new Set(goals).size!==goals.length||goals.some(id=>!availableGoals.includes(id)))throw Error('鐘の順番が不正です。');
 if(challenge.intervals!==undefined&&(!Array.isArray(challenge.intervals)||challenge.intervals.length!==goals.length-1||challenge.intervals.some(value=>scale.ticks(value)<=0n)))throw Error('鐘の間隔が不正です。');
 const tolerance=scale.ticks(challenge.intervalTolerance??'0');
 if(tolerance<0n)throw Error('間隔の許容幅が不正です。');
 // Content v1 may exist in saved results. New interval stages are exact.
 if((challenge.version??1)>=2&&tolerance!==0n)throw Error('指定間隔は完全一致で判定します。');
}
export function bellSequenceResult(challenge,run){
 const scale=run.circuit.time;validateBellSequence(challenge,scale,run.circuit.goals);
 const goals=challenge.goals.map(id=>({id,first:run.arrivals(id)[0]?.time??null})),gaps=[];
 let reason=null;
 for(let i=1;i<goals.length;i++){
  const before=goals[i-1].first,after=goals[i].first;if(before===null||after===null){gaps.push(null);continue;}
  const gap=scale.ticks(after)-scale.ticks(before);gaps.push(scale.format(gap));
  if(gap<=0n)reason='鐘が鳴る順番が条件と違います。同時到達は順番に含みません。';
  else if(challenge.intervals){const target=scale.ticks(challenge.intervals[i-1]),tolerance=scale.ticks(challenge.intervalTolerance??'0');if((gap>target?gap-target:target-gap)>tolerance&&!reason)reason='鐘が鳴る間隔が条件と違います。結果の時刻を確認してください。';}
 }
 const missing=goals.filter(g=>g.first===null);
 if(reason)return {state:'failed',actual:null,goals,gaps,reason};
 if(!missing.length)return {state:'achieved',actual:goals.at(-1).first,goals,gaps,reason:null};
 if(run.status==='stopped')return {state:'stopped',actual:null,goals,gaps,reason:null};
 const impossible=missing.some(g=>!run.hasFutureArrival(g.id));
 return {state:impossible?'failed':'pending',actual:null,goals,gaps,reason:impossible?'必要な鐘すべてに届く配線になっていません。':null};
}
