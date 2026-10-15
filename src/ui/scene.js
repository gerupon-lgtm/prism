import { svg } from './svg.js';
const art=name=>new URL(`../../public/graphics/${name}.png`,import.meta.url).href;
export const ARRIVAL_DURATION_MS=Object.freeze({prism:1000,goal:1800});

// Decoration has no circuit identifiers, hit targets, or simulation events.
export class Scene {
  constructor(board) {
    const defs=svg('defs');
    for(const [id,color,stops] of [['node-depth','#040b19',[[0,.85],[.5,.65],[1,0]]],['altar-light','#f5ddb0',[[0,.95],[.35,.55],[1,0]]],['prism-light','#ccecff',[[0,.95],[.3,.65],[1,0]]]]){
      const gradient=svg('radialGradient',{id});for(const [offset,opacity] of stops)gradient.append(svg('stop',{offset,'stop-color':color,'stop-opacity':opacity}));defs.append(gradient);
    }
    const column=svg('linearGradient',{id:'altar-column',x1:0,y1:1,x2:0,y2:0});
    for(const [offset,opacity] of [[0,.8],[.4,.3],[1,0]])column.append(svg('stop',{offset,'stop-color':'#fff1cf','stop-opacity':opacity}));defs.append(column);
    this.root=svg('g',{class:'scene','aria-hidden':'true'});board.prepend(defs,this.root);
  }
  draw(width,height,kind) {
    const signature=`${width}/${height}/${kind}`;if(signature===this.signature)return;
    this.signature=signature;this.root.replaceChildren();this.root.setAttribute('data-scene',kind);
    const stars=svg('g',{class:'sky-stars'});
    for(let i=0;i<48;i++)stars.append(svg('circle',{cx:((i*0.61803398875+0.07)%1)*width,cy:((i*0.41421356237+0.04)%1)*height,r:i%7===0?2.2:1,opacity:i%3===0?0.6:0.25}));
    this.root.append(stars);
    const layers=kind==='sky'?['ruins','observatory']:[kind];
    for(const [index,name] of layers.entries()){
      const panelWidth=width/layers.length,panel=svg('svg',{x:index*panelWidth,y:0,width:panelWidth,height,viewBox:`0 0 ${panelWidth} ${height}`,overflow:'hidden'});
      panel.append(svg('image',{href:art(name),x:0,y:0,width:panelWidth,height,preserveAspectRatio:`${name==='ruins'?'xMin':'xMax'}YMax slice`,class:name==='ruins'?'floating-ruin':'observatory'}));this.root.append(panel);
    }
    this.root.append(svg('rect',{x:0,y:0,width,height,class:'scene-shade'}));
  }
}

export function symbol(kind,factor) {
  const group=svg('g',{transform:`scale(${factor})`,class:'symbol-art','aria-hidden':'true'});
  group.append(svg('ellipse',{rx:78,ry:88,class:'node-separation'}),svg('ellipse',{rx:58,ry:65,class:'node-halo'}),svg('image',{href:art(kind),x:-55,y:-65,width:110,height:130,preserveAspectRatio:'xMidYMid meet',class:'node-symbol'}));
  return group;
}

export function constellation({x,y},factor,angle,id,age=0) {
  const group=svg('g',{transform:`translate(${x} ${y}) rotate(${-angle}) scale(${factor})`,class:'arrival-art','data-arrived-particle':id,'aria-hidden':'true'});
  group.style.setProperty('--arrival-age',`-${age}ms`);
  group.style.setProperty('--arrival-duration',`${ARRIVAL_DURATION_MS.goal}ms`);
  const dots=[[-150,25],[-145,-70],[-80,-145],[25,-175],[125,-125],[160,-25],[110,110],[-75,120]];
  group.append(svg('ellipse',{cy:0,rx:150,ry:170,class:'arrival-glow'}));
  group.append(svg('path',{d:'M-35,18 L-65,-270 L65,-270 L35,18 Z',class:'altar-column'}));
  const rays=svg('g',{class:'altar-rays'});
  for(let index=0;index<12;index++){
    const angle=index*Math.PI/6,dx=Math.cos(angle),dy=Math.sin(angle);
    rays.append(svg('path',{d:`M${dx*62} ${dy*68} L${dx*165} ${dy*175}`,class:'altar-ray'}));
  }
  group.append(rays);
  // Use the star positions themselves so every segment meets both endpoints.
  // Each link starts after its destination star has finished appearing.
  const links=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[1,7]];
  links.forEach(([from,to])=>{
    const [fromX,fromY]=dots[from],[x,y]=dots[to],link=svg('path',{d:`M${fromX},${fromY} L${x},${y}`,pathLength:1,class:'constellation-line'});
    link.style.setProperty('--link-delay',`${320+to*60}ms`);group.append(link);
  });
  dots.forEach(([cx,cy],index)=>{const star=svg('g',{class:'constellation-star',transform:`translate(${cx} ${cy})`});star.style.setProperty('--star-delay',`${80+index*60}ms`);star.append(svg('circle',{r:index%3===0?6:4.5}));star.append(svg('path',{d:'M-10,0 L10,0 M0,-10 L0,10',class:'star-ray'}));group.append(star);});
  return group;
}

export function prismArrival({x,y},factor,angle,id,age=0) {
  const group=svg('g',{transform:`translate(${x} ${y}) rotate(${-angle}) scale(${factor})`,class:'arrival-art prism-arrival','data-arrived-particle':id,'aria-hidden':'true'});
  group.style.setProperty('--arrival-age',`-${age}ms`);group.style.setProperty('--arrival-duration',`${ARRIVAL_DURATION_MS.prism}ms`);
  group.append(svg('ellipse',{rx:115,ry:115,class:'prism-arrival-glow'}));
  const flare=svg('g',{class:'prism-flare'});
  for(let index=0;index<12;index++){
    const angle=index*Math.PI/6,dx=Math.cos(angle),dy=Math.sin(angle);
    flare.append(svg('path',{d:`M${dx*60} ${dy*60} L${dx*135} ${dy*135}`}));
  }
  group.append(flare);
  const colors=['#fff1cf','#bfe8ff','#d5b9ff','#a9e9f0','#f2c7da','#ffe3a2'];
  for(let index=0;index<12;index++){
    const angle=index*Math.PI/6,dx=Math.cos(angle)*145,dy=Math.sin(angle)*145;
    const shard=svg('g',{class:'prism-shard'});shard.style.setProperty('--shard-x',`${dx}px`);shard.style.setProperty('--shard-y',`${dy}px`);shard.style.setProperty('--shard-color',colors[index%colors.length]);
    shard.append(svg('path',{d:index%2?'M0,-12 L6,0 L0,12 L-6,0 Z':'M0,-20 L8,0 L0,20 L-8,0 Z'}));group.append(shard);
  }
  return group;
}
