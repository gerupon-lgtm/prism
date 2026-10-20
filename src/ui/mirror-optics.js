// Pure screen-space angles in radians. The surface is its tangent, not its normal.
const TAU=2*Math.PI,DEG=Math.PI/180,EPS=1e-12;
const normalize=angle=>{
  let result=angle%TAU;
  if(result>=Math.PI)result-=TAU;
  if(result< -Math.PI)result+=TAU;
  return result===0?0:result;
};

// Screen pixels, independent of the board's zoom and rotation. The chosen
// centre is retained for the whole selection so the control never runs away.
export function placeMirrorControl({bounds,origin,obstacles=[],radius=58}){
  const inset=radius+4,left=Math.min(bounds.left+inset,(bounds.left+bounds.right)/2),right=Math.max(bounds.right-inset,left);
  const top=Math.min(bounds.top+inset,(bounds.top+bounds.bottom)/2),bottom=Math.max(bounds.bottom-inset,top);
  const candidates=[];
  for(const distance of [145,185])for(let i=0;i<8;i++)candidates.push({x:Math.max(left,Math.min(right,origin.x+distance*Math.cos(i*Math.PI/4))),y:Math.max(top,Math.min(bottom,origin.y+distance*Math.sin(i*Math.PI/4)))});
  for(const fx of [0,1,.5])for(const fy of [0,.5,1,.25,.75])candidates.push({x:left+(right-left)*fx,y:top+(bottom-top)*fy});
  let best=null;
  for(const {x,y} of candidates){
    const gaps=obstacles.map(r=>Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom))-radius);
    const distance=Math.hypot(x-origin.x,y-origin.y),clearance=Math.min(12,...gaps);
    const score=clearance*20-Math.abs(distance-145)-Math.max(0,120-distance)*4;
    if(!best||score>best.score)best={x,y,score};
  }
  return {x:best.x,y:best.y};
}

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
