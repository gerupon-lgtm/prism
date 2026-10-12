import { svg } from './svg.js';

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
    if(kind==='ruins'||kind==='sky'){
      for(const [x,y,size] of [[0.05,0.28,0.75],[0.88,0.55,0.6],[0.18,0.8,1]]){
        const scale=Math.min(width,height)/600*size,ruin=svg('g',{class:'floating-ruin',transform:`translate(${width*x} ${height*y}) scale(${scale})`});
        ruin.append(svg('path',{d:'M-70 18 L76 18 L48 37 L35 88 L-20 113 L-50 56 Z',class:'island'}),svg('path',{d:'M-64 6 H68 V18 H-64 Z M-55 -111 H-28 V6 H-55 Z M27 -126 H52 V6 H27 Z M-60 -119 H-22 V-108 H-60 Z M22 -134 H57 V-122 H22 Z',class:'stone'}),svg('path',{d:'M-42 -79 Q-40 -134 39 -108 M-57 -106 H-28 M27 -122 H51 M-35 40 L-27 80 M7 30 L-3 88',class:'stone-line'}));
        this.root.append(ruin);
      }
    }
    if(kind==='observatory'||kind==='sky'){
      const size=Math.min(width*.7,height*.7),scale=size/400,dome=svg('g',{class:'observatory',transform:`translate(${width*.54} ${height*.37}) scale(${scale})`});
      dome.append(svg('path',{d:'M-180 0 A180 180 0 0 1 180 0 L180 24 H-180 Z M-160 24 V180 H160 V24 Z',class:'dome-shell'}),svg('path',{d:'M-180 0 H180 M-180 24 H180 M0 -180 V24 M-155 -88 Q0 -42 155 -88 M-103 -148 Q0 -122 103 -148 M0 -180 C-80 -140 -100 -70 -100 0 M0 -180 C80 -140 100 -70 100 0 M-140 24 V166 M-84 24 V166 M-28 24 V166 M28 24 V166 M84 24 V166 M140 24 V166 M-168 180 H168 M-180 193 H180',class:'dome-line'}),svg('ellipse',{cx:0,cy:-76,rx:110,ry:36,transform:'rotate(-27 0 -76)',class:'armillary'}));
      this.root.append(dome);
    }
  }
}

export function symbol(kind,factor) {
  const group=svg('g',{transform:`scale(${factor})`,class:'symbol-art','aria-hidden':'true'});
  if(kind==='prism'){
    group.append(svg('path',{d:'M0 -39 L34 0 L0 39 L-34 0 Z',class:'node-symbol'}),svg('path',{d:'M0 -39 L-7 -1 L0 39 L34 0 Z',class:'prism-facet'}),svg('path',{d:'M0 -39 L-7 -1 L-34 0 M-7 -1 L34 0 M-7 -1 L0 39',class:'prism-seam'}));
  }else if(kind==='source'){
    group.append(svg('path',{d:'M0 -43 L12 -13 L39 0 L12 13 L0 43 L-12 13 L-39 0 L-12 -13 Z',class:'node-symbol'}),svg('circle',{r:8,class:'star-core'}));
  }else{
    group.append(svg('path',{d:'M-20 12 Q-14 8 -14 -4 Q-14 -26 0 -26 Q14 -26 14 -4 Q14 8 20 12 Z',class:'node-symbol'}),svg('path',{d:'M-29 30 H29 M-38 40 H38 M-46 50 H46',class:'altar-steps'}),svg('circle',{cx:0,cy:19,r:4,class:'chime-clapper'}),svg('circle',{cx:0,cy:-30,r:4,class:'chime-clapper'}));
  }
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
