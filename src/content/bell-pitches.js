// Presentation only: never change arrival times or scoring for musical reasons.
export function arrivalFrequencies(challenge,arrivals,timeScale){
 const result=new Map();let previous=null;
 for(const entry of arrivals){
  const index=challenge?.goals?.indexOf(entry.node)??-1,midi=challenge?.bellPitches?.[index];
  let frequencyHz=midi===undefined?440:440*2**((midi-69)/12);
  const at=timeScale.ticks(entry.time);
  if(midi!==undefined&&previous&&at-previous.at<timeScale.ticks('0.5'))frequencyHz=previous.frequencyHz;
  result.set(entry,frequencyHz);previous={at,frequencyHz};
 }
 return result;
}
