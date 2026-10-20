// Pure screen-space angles in radians. The surface is its tangent, not its normal.
const TAU=2*Math.PI,DEG=Math.PI/180,EPS=1e-12;
const normalize=angle=>{
  let result=angle%TAU;
  if(result>=Math.PI)result-=TAU;
  if(result< -Math.PI)result+=TAU;
  return result===0?0:result;
};

export function reflect(incidentAngle,surfaceAngle){
  // Reduce first so even large finite inputs cannot overflow during doubling.
  return normalize(2*normalize(surfaceAngle)-normalize(incidentAngle));
}

export function surfaceFor(incidentAngle,outgoingAngle){
  let surface=(normalize(incidentAngle)+normalize(outgoingAngle))/2;
  // A mirror surface is unchanged by a half turn.
  if(surface>=Math.PI/2)surface-=Math.PI;
  if(surface< -Math.PI/2)surface+=Math.PI;
  return surface===0?0:surface;
}

export function angleGap(a,b){
  return Math.abs(normalize(normalize(a)-normalize(b)));
}

export function snapTarget(angle,targets,previousId=null){
  if(!targets.length)return null;
  const distances=targets.map(target=>({id:target.id,gap:angleGap(angle,target.angle)}));
  const best=distances.reduce((a,b)=>a.gap<=b.gap?a:b);
  const previous=distances.find(target=>target.id===previousId);
  // A wider release cone and a small tie margin keep a held target steady.
  if(previous&&previous.gap<=30*DEG+EPS&&previous.gap<=best.gap+4*DEG+EPS)return previous.id;
  if(best.gap>22*DEG+EPS)return null;
  if(distances.some(target=>target.id!==best.id&&target.gap<=best.gap+4*DEG+EPS))return null;
  return best.id;
}

export function unalignedAngle(targets){
  if(!targets.length)return -Math.PI/4;
  const angles=targets.map(target=>{
    const angle=normalize(target.angle);
    return angle<0?angle+TAU:angle;
  }).sort((a,b)=>a-b);
  let largest=-1,midpoint=0;
  for(let i=0;i<angles.length;i++){
    const start=angles[i],end=i+1<angles.length?angles[i+1]:angles[0]+TAU;
    const gap=end-start;
    // Equal gaps use the first angular position, independent of target order.
    if(gap>largest+EPS){largest=gap;midpoint=start+gap/2;}
  }
  return normalize(midpoint);
}
