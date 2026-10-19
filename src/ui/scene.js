import { svg } from './svg.js';
const art=name=>new URL(`../../public/graphics/${name}.png`,import.meta.url).href;
export const ARRIVAL_DURATION_MS=Object.freeze({prism:1000,goal:1800});

// Decoration has no circuit identifiers, hit targets, or simulation events.
export class Scene {
  constructor(board) {
    const defs=svg('defs');
    for(const [id,color,stops] of [['node-depth','#040b19',[[0,.85],[.5,.65],[1,0]]],['altar-light','#f5ddb0',[[0,.95],[.35,.55],[1,0]]],['prism-light','#ccecff',[[0,.95],[.3,.65],[1,0]]],['particle-light','#ffe4a0',[[0,.8],[.3,.45],[.65,.12],[1,0]]]]){
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
      panel.append(svg('image',{href:art(name),x:0,y:0,width:panelWidth,height,preserveAspectRatio:`${name==='ruins'?'xMin':['starwalk','moonwater','starecho'].includes(name)?'xMid':'xMax'}YMax slice`,class:name==='ruins'?'floating-ruin':'observatory'}));this.root.append(panel);
    }
    this.root.append(svg('rect',{x:0,y:0,width,height,class:'scene-shade'}));
  }
}

export function symbol(kind,factor) {
  const group=svg('g',{transform:`scale(${factor})`,class:'symbol-art','aria-hidden':'true'});
  group.append(svg('ellipse',{rx:78,ry:88,class:'node-separation'}));
  if(kind==='goal'){
    group.append(svg('ellipse',{rx:88,ry:98,class:'goal-reached-aura'}));
    const stars=svg('g',{class:'goal-arrival-stars'});
    for(const [x,y] of [[-64,-43],[65,28]]){
      const star=svg('g',{transform:`translate(${x} ${y})`});star.append(svg('circle',{r:16,class:'star-aureole'}),svg('path',{d:'M0,-11 Q2,-2 8,0 Q2,2 0,11 Q-2,2 -8,0 Q-2,-2 0,-11 Z',class:'star-point'}));stars.append(star);
    }group.append(stars);
  }
  group.append(svg('ellipse',{rx:58,ry:65,class:'node-halo'}),svg('image',{href:art(kind),x:-55,y:-65,width:110,height:130,preserveAspectRatio:'xMidYMid meet',class:'node-symbol'}));
  return group;
}

export function constellation({x,y},factor,angle,id,age=0) {
  const group=svg('g',{transform:`translate(${x} ${y}) rotate(${-angle}) scale(${factor})`,class:'arrival-art','data-arrived-particle':id,'aria-hidden':'true'});
  group.style.setProperty('--arrival-age',`-${age}ms`);
  group.style.setProperty('--arrival-duration',`${ARRIVAL_DURATION_MS.goal}ms`);
  group.append(svg('ellipse',{rx:95,ry:110,class:'arrival-glow'}));
  const beacon=svg('g',{class:'bell-arrival-beacon'});
  for(const angle of [-55,-25,25,55,125,155,205,235])beacon.append(svg('path',{d:'M0,-66 L0,-104',transform:`rotate(${angle})`,class:'bell-arrival-ray'}));
  group.append(beacon);
  group.append(svg('path',{d:'M-18,15 L-30,-190 L30,-190 L18,15 Z',class:'altar-column'}));
  // Approved B: a diamond suspension, a closed flared body and an inner clapper.
  // This is a fictional bell motif, not a chart of an astronomical constellation.
  const dots=[[0,-200],[-36,-164],[0,-128],[36,-164],[0,-104],[-50,-86],[-84,-40],[-102,22],[-118,94],[-144,152],[-176,200],[-88,200],[0,200],[88,200],[176,200],[144,152],[118,94],[102,22],[84,-40],[50,-86],[0,-40],[0,42],[0,104],[-24,132],[0,158],[24,132]];
  const parts=['suspension','suspension','suspension','suspension',...Array(16).fill('body'),...Array(6).fill('clapper')];
  const delays=[40,65,90,65,115,140,165,190,215,240,265,290,315,290,265,240,215,190,165,140,190,215,240,265,290,265];
  const primary=new Set([0,2,4,6,10,12,14,18,22,24]);
  const motif=svg('g',{class:'bell-constellation','data-constellation':'bell-b'});
  const links=[[0,1],[1,2],[2,3],[3,0],[2,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,4],[6,20],[20,18],[20,21],[21,22],[22,23],[23,24],[24,25],[25,22]];
  links.forEach(([from,to])=>{
    const [fromX,fromY]=dots[from],[x,y]=dots[to],link=svg('path',{d:`M${fromX},${fromY} L${x},${y}`,pathLength:1,class:'constellation-line'});
    link.style.setProperty('--link-delay',`${Math.max(delays[from],delays[to])+180}ms`);motif.append(link);
  });
  dots.forEach(([cx,cy],index)=>{
    const bright=primary.has(index),star=svg('g',{class:`constellation-star${bright?' primary-star':''}`,transform:`translate(${cx} ${cy})`,'data-bell-part':parts[index]});
    star.style.setProperty('--star-delay',`${delays[index]}ms`);
    star.append(svg('circle',{r:bright?12:7,class:'star-aureole'}),svg('circle',{r:bright?3.2:2.2,class:'star-point'}));
    if(bright)star.append(svg('path',{d:'M0,-12 Q1.3,-1.3 9,0 Q1.3,1.3 0,12 Q-1.3,1.3 -9,0 Q-1.3,-1.3 0,-12 Z',class:'star-diffraction'}));
    motif.append(star);
  });
  group.append(motif);
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
