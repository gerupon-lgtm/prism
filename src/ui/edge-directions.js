// Screen-space geometry only. Never changes a route, its direction or its time.
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
export function directionMarkers({points,obstacles=[],otherMarkers=[],area,bidirectional=false,size=11}){
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return [];
  const halfWidth=4.5*size/11,gap=size<11?2:4;
  const segments=[];let length=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],size=Math.hypot(b.x-a.x,b.y-a.y);
    if(size>0){segments.push({a,b,start:length,size});length+=size;}
  }
  if(!length)return [];
  const shape=(distance,direction)=>{
    const s=segments.find(s=>distance<=s.start+s.size)??segments.at(-1),t=(distance-s.start)/s.size;
    const tip={x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t},dx=(s.b.x-s.a.x)/s.size*direction,dy=(s.b.y-s.a.y)/s.size*direction;
    const wings=[-1,1].map(sign=>({x:tip.x-dx*size-dy*halfWidth*sign,y:tip.y-dy*size+dx*halfWidth*sign}));
    const vertices=[wings[0],tip,wings[1]],rect={left:Math.min(...vertices.map(p=>p.x))-gap,top:Math.min(...vertices.map(p=>p.y))-gap,right:Math.max(...vertices.map(p=>p.x))+gap,bottom:Math.max(...vertices.map(p=>p.y))+gap};
    if(area&&(rect.left<area.left+2||rect.right>area.right-2||rect.top<area.top+2||rect.bottom>area.bottom-2))return null;
    if(obstacles.some(other=>intersects(rect,other)))return null;
    return {vertices,rect,distance,direction,size};
  };
  const count=Math.min(1024,Math.max(48,Math.ceil(length/2)));
  const candidates=direction=>Array.from({length:count-1},(_,i)=>shape(length*(i+1)/count,direction)).filter(Boolean);
  const compact=()=>size>8?directionMarkers({points,obstacles,otherMarkers,area,bidirectional,size:8}):[];
  const forward=candidates(1);if(!forward.length)return compact();
  // Other arrows are a spacing preference, not a reason to erase a route's
  // direction when two distinct routes share a visible section of the line.
  const penalty=new WeakMap(),cost=(marker,target)=>{
    if(!penalty.has(marker))penalty.set(marker,otherMarkers.filter(box=>intersects(marker.rect,box)).length*30);
    return Math.abs(marker.distance-target)+penalty.get(marker);
  };
  const separate=(a,b)=>Math.abs(a.distance-b.distance)>=38&&!intersects(a.rect,b.rect);
  if(bidirectional){
    const backward=candidates(-1);
    for(const end of [...forward].reverse()){
      const start=backward.find(start=>separate(start,end));
      if(start)return [start,end];
    }
    // A single arrow would falsely imply one-way travel on a two-way route.
    return compact();
  }
  const start=forward[0].distance,last=forward.at(-1).distance,span=last-start;
  const end=forward.reduce((a,b)=>cost(a,last)<=cost(b,last)?a:b);
  if(span<120)return [end];
  const middle=[...forward].sort((a,b)=>cost(a,start+span*.45)-cost(b,start+span*.45)).find(marker=>separate(marker,end));
  return middle?[middle,end]:[end];
}
