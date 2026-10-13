import { svg } from './svg.js';
const art=name=>new URL(`../../public/graphics/${name}.png`,import.meta.url).href;

// Decoration has no circuit identifiers, hit targets, or simulation events.
export class Scene {
  constructor(board) {
    const defs=svg('defs');
    for(const [id,color,stops] of [['node-depth','#040b19',[[0,.85],[.5,.65],[1,0]]],['altar-light','#f5ddb0',[[0,.75],[.35,.3],[1,0]]]]){
      const gradient=svg('radialGradient',{id});for(const [offset,opacity] of stops)gradient.append(svg('stop',{offset,'stop-color':color,'stop-opacity':opacity}));defs.append(gradient);
    }
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
  const dots=[[-116,20],[-108,-52],[-55,-105],[35,-126],[100,-74],[120,8],[75,85]];
  group.append(svg('ellipse',{cy:8,rx:85,ry:105,class:'arrival-glow'}));
  group.append(svg('path',{d:`M-116,20 L-108,-52 L-55,-105 M35,-126 L100,-74 L120,8`,class:'constellation-line'}));
  dots.forEach(([cx,cy],index)=>{const star=svg('g',{class:'constellation-star',transform:`translate(${cx} ${cy})`});star.style.setProperty('--star-delay',`${80+index*45}ms`);star.append(svg('circle',{r:index%3===0?3:2}));if(index%3===0)star.append(svg('path',{d:'M-6,0 L6,0 M0,-6 L0,6',class:'star-ray'}));group.append(star);});
  return group;
}
