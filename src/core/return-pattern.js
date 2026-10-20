// Compare only the requested first arrivals on the exact simulation clock.
// Returning to the star must have produced another branch before the last one.
export function validateReturnPattern(challenge,scale,availableGoals) {
  if(typeof challenge.goal!=='string'||!availableGoals.includes(challenge.goal)||!Number.isSafeInteger(challenge.count)||challenge.count<2)throw new Error('鐘と到達回数の条件が不正です。');
  if(typeof challenge.interval!=='string'||scale.ticks(challenge.interval)<=0n)throw new Error('鐘の指定間隔は0より大きい秒数です。');
}

export function returnPatternResult(challenge,run) {
  const scale=run.circuit.time;
  validateReturnPattern(challenge,scale,run.circuit.goals);
  const arrivals=run.arrivals(challenge.goal).slice(0,challenge.count);
  const first=arrivals[0]?.time??null;
  const actual=arrivals.length===challenge.count?arrivals.at(-1).time:null;
  const result=state=>({state,actual,first});
  const interval=scale.ticks(challenge.interval);
  if(arrivals.some((row,index)=>index>0&&scale.ticks(row.time)-scale.ticks(arrivals[index-1].time)!==interval))return {...result('failed'),reason:'鐘が鳴る間隔が条件と違います。結果の時刻を確認してください。'};
  if(actual!==null) {
    const last=scale.ticks(actual);
    const returnedBranch=run.records.some(row=>row.type==='branch'&&row.node===run.circuit.source&&scale.ticks(row.time)>0n&&scale.ticks(row.time)<=last);
    return returnedBranch?result('achieved'):{...result('failed'),reason:'光を星へ戻し、星でもう一度分岐させてください。'};
  }
  if(run.status==='stopped')return result('stopped');
  if(!run.hasFutureArrival(challenge.goal))return {...result('failed'),reason:'指定した回数まで鐘に届く配線になっていません。'};
  return result('pending');
}
