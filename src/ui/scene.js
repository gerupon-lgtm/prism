import { svg } from './svg.js';
const art=name=>new URL(`../../public/graphics/${name}.png`,import.meta.url).href;

// Decoration has no circuit identifiers, hit targets, or simulation events.
export class Scene {
  constructor(board) {
    this.root=svg('g',{class:'scene','aria-hidden':'true'});board.prepend(this.root);
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
  group.append(svg('ellipse',{rx:58,ry:65,class:'node-halo'}),svg('image',{href:art(kind),x:-55,y:-65,width:110,height:130,preserveAspectRatio:'xMidYMid meet',class:'node-symbol'}));
  return group;
}

export function constellation({x,y},factor,angle,id) {
  const group=svg('g',{transform:`translate(${x} ${y}) rotate(${-angle}) scale(${factor})`,class:'arrival-art','data-arrived-particle':id,'aria-hidden':'true'});
  const dots=[[-100,-29],[-64,-78],[-13,-107],[58,-72],[101,-19],[70,72],[-20,106],[-80,70]];
  group.append(svg('path',{d:dots.map(([dx,dy],index)=>`${index?'L':'M'}${dx} ${dy}`).join(' '),class:'constellation-line'}));
  for(const [cx,cy] of dots)group.append(svg('circle',{cx,cy,r:3.5,class:'constellation-star'}));
  group.append(svg('circle',{r:44,class:'arrival-ring'}),svg('circle',{r:12,class:'arrived-light'}));
  return group;
}
