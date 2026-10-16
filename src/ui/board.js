import { svg } from './svg.js';
import { Scene,symbol,constellation,prismArrival,ARRIVAL_DURATION_MS } from './scene.js';
import { Magnifier } from './magnifier.js';
import { partName,objectName } from './labels.js';

// Display only; inverse projection keeps saved/edit coordinates unchanged.
const CIRCUIT_WIDTH = 1.5;
const WIRING_HIT=Object.freeze({startMargin:8,releaseMargin:12,passMin:20,passMax:26});
const secondsLabel=value=>`${value.length>4?value.slice(0,2)+'…':value}s`;

export class Board {
  constructor(element, session, changed, openSettings, notify, connected=()=>{},requestDelete=()=>{}) {
    Object.assign(this,{element,session,changed,openSettings,notify,connected,requestDelete});
    this.orientation = svg('g',{class:'board-orientation',id:'board-detail'}); this.world = svg('g'); this.particleLayer = svg('g');this.effectsLayer=svg('g',{class:'arrival-layer'});
    this.fireworksLayer=svg('g',{class:'fireworks-layer','aria-hidden':'true'});
    this.orientation.append(this.fireworksLayer,this.effectsLayer,this.world,this.particleLayer); element.append(this.orientation);
    this.scene=new Scene(element);this.arrivalPictures=new Map();this.pictureRun=null;
    this.goalHistories=new WeakMap();
    this.magnifier=new Magnifier(this);
    this.pointers = new Map(); this.gesture = null; this.lastTap = null; this.addKind = null;
    element.addEventListener('pointerdown',event=>this.down(event));
    element.addEventListener('pointermove',event=>this.move(event));
    element.addEventListener('pointerup',event=>this.up(event));
    element.addEventListener('pointercancel',event=>this.cancel(event));
    element.addEventListener('lostpointercapture',event=>{if(this.pointers.has(event.pointerId))this.cancel(event);});
    element.addEventListener('contextmenu',event=>event.preventDefault());
    element.addEventListener('wheel',event=>{event.preventDefault();this.zoom(event.deltaY<0?1.15:1/1.15,event.clientX,event.clientY);},{passive:false});
    this.resizeObserver = new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(element);
    this.render(); this.resize();
  }
  resize() {
    this.angle=Number(document.documentElement.dataset.boardRotation||0);
    // Fill the available width instead of centering a narrow fixed-aspect diagram.
    this.frameWidth=2080*(this.element.clientWidth||1360)/(this.element.clientHeight||2080);
    this.displayWidthRatio=this.frameWidth/1360;
    this.element.setAttribute('viewBox',`${500-this.frameWidth/2} -240 ${this.frameWidth} 2080`);
    this.orientation.setAttribute('transform','');
    this.cancelAll(); this.transform(); this.render();
  }
  transform() {
    const {panX,panY,zoom}=this.session.view;
    const matrix=`translate(${panX} ${panY}) scale(${zoom})`;
    this.world.setAttribute('transform',matrix); this.particleLayer.setAttribute('transform',matrix);this.effectsLayer.setAttribute('transform',matrix);
    const screenMatrix=this.world.getScreenCTM();
    if(screenMatrix){const scale=Math.hypot(screenMatrix.a,screenMatrix.b);this.fontFactor=Math.max(1,0.5/scale);this.particleRadius=Math.min(9,Math.max(6,18*scale))/scale;this.element.style.setProperty('--board-factor',this.fontFactor);}
  }
  location(x,y,matrix=this.world.getScreenCTM().inverse()) {
    return new DOMPoint(x,y).matrixTransform(matrix);
  }
  position(node) {return {x:500+(((node.x??0.5)/(this.projectionScale??1))*1000-500)*CIRCUIT_WIDTH*(this.displayWidthRatio??1),y:1600-((node.y??0.5)/(this.projectionScale??1))*1600};}
  coordinates(at) {return {x:((at.x-500)/(CIRCUIT_WIDTH*(this.displayWidthRatio??1))+500)/1000*(this.projectionScale??1),y:(1600-at.y)/1600*(this.projectionScale??1)};}
  zoom(factor,x,y) {
    const rect=this.element.getBoundingClientRect();
    x ??= rect.left+rect.width/2; y ??= rect.top+rect.height/2;
    const before=this.location(x,y), old=this.session.view.zoom, next=Math.max(0.25,Math.min(6,old*factor));
    this.session.view.panX += before.x*(old-next); this.session.view.panY += before.y*(old-next);
    this.session.view.zoom=next; this.transform(); this.render();
  }
  fitView() {
    const input=this.session.run&&this.session.run.status!=='stopped'?this.session.run.circuit.raw:this.session.circuit;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const node of input.nodes){const at=this.position(node);minX=Math.min(minX,at.x);minY=Math.min(minY,at.y);maxX=Math.max(maxX,at.x);maxY=Math.max(maxY,at.y);}
    const zoom=Math.min(6,(this.frameWidth??1360)*1000/1360/(maxX-minX+250),1600/(maxY-minY+300));
    return {zoom,panX:500-(minX/2+maxX/2)*zoom,panY:800-(minY/2+maxY/2)*zoom};
  }
  fit() {
    Object.assign(this.session.view,this.fitView());this.transform();this.render();
  }
  render() {
    this.world.replaceChildren(); this.curves = new Map(); this.transform();
    const kind=this.session.mode==='free'?'sky':this.session.challenge.world??(Number(this.session.challenge.id.slice(1))<=3?'ruins':'observatory');
    const sceneWidth=(this.frameWidth??1360)*.85;
    this.scene.draw(sceneWidth,1600,kind);this.scene.root.setAttribute('transform',`translate(${500-sceneWidth/2} 0)`);
    const input=this.session.run && this.session.run.status!=='stopped' ? this.session.run.circuit.raw : this.session.circuit;
    let extent=1;for(const node of input.nodes)extent=Math.max(extent,Math.abs(node.x??0.5),Math.abs(node.y??0.5));
    // Display projection only; original coordinates are retained in circuit files.
    this.projectionScale=extent>1000?extent:1;
    const nodes=new Map(input.nodes.map(node=>[node.id,node]));
    let symbolFactor=this.fontFactor??1,sideNames=false;
    const screenMatrix=this.world.getScreenCTM(),screenScale=screenMatrix?Math.hypot(screenMatrix.a,screenMatrix.b):0;
    if(this.session.mode==='challenge'&&nodes.size>5&&screenMatrix){
      const positions=input.nodes.map(node=>this.position(node)),scale=Math.hypot(screenMatrix.a,screenMatrix.b);
      let spacing=Infinity;
      for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)spacing=Math.min(spacing,Math.hypot(positions[i].x-positions[j].x,positions[i].y-positions[j].y)*scale);
      // Keep dense small-screen parts apart; hit areas still have a 44px minimum.
      symbolFactor=Math.min(symbolFactor,Math.max(36,spacing*.8)/(130*scale),parseFloat(getComputedStyle(document.documentElement).fontSize)>=20?44/(130*scale):Infinity);
      sideNames=symbolFactor<(this.fontFactor??1)&&spacing<75;
    }

    const candidates=this.session.mode==='challenge' ? this.session.challenge.candidates.filter(edge=>!input.edges.some(built=>built.id===edge.id)) : [];
    const all=[...input.edges,...candidates];
    const timeOrigin=nodes.has(this.session.selection)?this.session.selection:input.nodes.find(node=>node.kind==='source')?.id;
    const timeCards=[];
    const parallels=new Map();
    for(const edge of all){const key=JSON.stringify([edge.from,edge.to].sort());let list=parallels.get(key);if(!list){list=[];parallels.set(key,list);}list.push(edge);}
    for (const edge of all) {
      const a=this.position(nodes.get(edge.from)),b=this.position(nodes.get(edge.to));
      const parallel=parallels.get(JSON.stringify([edge.from,edge.to].sort()));
      const at=parallel.findIndex(other=>other.id===edge.id), offset=(at-(parallel.length-1)/2)*95;
      const length=Math.hypot(b.x-a.x,b.y-a.y),normal=offset*(edge.from<edge.to?1:-1);
      const control=length ? {x:(a.x+b.x)/2-(b.y-a.y)/length*normal,y:(a.y+b.y)/2+(b.x-a.x)/length*normal} : {x:a.x+160+offset,y:a.y-160-offset};
      const curve={a,b,control}; this.curves.set(edge.id,curve);
      const candidate=candidates.includes(edge),disabled=edge.enabled===false||nodes.get(edge.from).enabled===false||nodes.get(edge.to).enabled===false;
      const group=svg('g',{'data-edge':edge.id,class:`edge${candidate?' candidate':''}${disabled?' unavailable':''}${this.session.selection===edge.id?' selected':''}${!candidate&&this.removalId===edge.id?' pending-delete':''}`,tabindex:0,role:'button','aria-label':`${candidate?'未結線の候補':'結線済みの配線'}：${partName(nodes.get(edge.from),input.nodes)} ${edge.bidirectional?'と':'から'} ${partName(nodes.get(edge.to),input.nodes)}へ、${edge.time}秒`});
      group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.session.selection=edge.id;this.openSettings();}});
      const d=`M${a.x},${a.y} Q${control.x},${control.y} ${b.x},${b.y}`;
      group.append(svg('path',{d,class:'edge-hit'}),svg('path',{d,class:'edge-backdrop'}),svg('path',{d,class:'edge-line'}));
      if(!candidate)group.append(svg('path',{d,class:'edge-core'}));
      // Stagger parallel labels along the path, rather than stacking at its midpoint.
      const progress=parallel.length>1?.32+.36*at/(parallel.length-1):.5;
      const middle=this.onCurve(curve,edge.from<edge.to?progress:1-progress), label=svg('g',{class:'edge-label',transform:`translate(${middle.x} ${middle.y}) rotate(${-this.angle})`});
      const factor=this.fontFactor??1,card=svg('rect',{class:'edge-label-card',rx:10*factor}),text=svg('text',{y:0,class:'edge-time'},secondsLabel(edge.time));
      label.append(card,text);if(candidate&&this.session.view.showAllTimes===false&&edge.from!==timeOrigin&&!(edge.bidirectional&&edge.to===timeOrigin))label.setAttribute('hidden','');group.append(label);
      this.world.append(group);
      timeCards.push({card,text,factor});
    }
    for (const node of input.nodes) {
      const at=this.position(node),selected=this.session.selection===node.id;
      const group=svg('g',{'data-node':node.id,class:`node ${node.kind}${selected?' selected':''}${node.enabled===false?' unavailable':''}`,transform:`translate(${at.x} ${at.y}) rotate(${-this.angle})`,tabindex:0,role:'button','aria-label':`${partName(node,input.nodes)}${node.enabled===false?' 使用不可':''}`});
      const factor=this.fontFactor??1;
      group.append(svg('circle',{r:Math.max(65*symbolFactor,screenScale>0?22/screenScale:0),class:'node-hit'}));
      group.append(symbol(node.kind,symbolFactor));
      if(node.enabled===false)group.append(svg('path',{d:`M${-28*factor} ${-28*factor} L${28*factor} ${28*factor} M${28*factor} ${-28*factor} L${-28*factor} ${28*factor}`,class:'disabled-mark'}));
      const label=partName(node,input.nodes,true);
      group.append(svg('title',{},`${label}${node.kind==='goal'?'':`：${node.process}秒`}`),svg('text',{x:sideNames?(node.x>.5?-1:1)*(65*symbolFactor+16*factor):0,y:sideNames?0:-80*factor,class:'node-name'},label.length>8?`${label.slice(0,7)}…`:label));
      if(node.kind!=='goal'){
        const text=svg('text',{y:90*symbolFactor,class:'node-time'},secondsLabel(node.process));
        group.append(text);
      }else group.dataset.baseLabel=group.getAttribute('aria-label');
      if(selected&&this.session.mode==='free'&&this.session.editable) group.append(svg('circle',{cx:55*factor,cy:-45*factor,r:19*factor,'data-move':node.id,class:'move-handle'}));
      group.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();this.session.selection=node.id;this.render();this.openSettings();}
      });
      this.world.append(group);
    }
    const cardSizes=timeCards.map(item=>({...item,bounds:item.text.getBBox()}));
    for(const {card,factor,bounds} of cardSizes)for(const [name,value] of Object.entries({x:bounds.x-10*factor,y:bounds.y-6*factor,width:bounds.width+20*factor,height:bounds.height+12*factor}))card.setAttribute(name,value);
    const selected=this.world.querySelector(`[data-node="${CSS.escape(this.session.selection??'')}"]`);if(selected)this.world.append(selected);
    if (this.session.selection) {
      for(const group of this.world.querySelectorAll('[data-node]')) {
        if(candidates.some(edge=>edge.from===this.session.selection&&edge.to===group.dataset.node)) group.classList.add('choice');
      }
    }
    this.wire=svg('path',{class:'wire-preview'});this.world.append(this.wire);this.previewWire();
    this.timeLayoutSignature=null;this.labelOrigins=new Map();
    this.particles();
    this.effectsLayer.replaceChildren();
    this.renderArrivals();
  }
  fitTimeLabels() {
    const worldMatrix=this.world.getScreenCTM();
    if(!worldMatrix)return;
    const area=this.element.getBoundingClientRect();
    const labels=[...this.world.querySelectorAll('.node-name'),...this.world.querySelectorAll('.node-time'),...this.world.querySelectorAll('.edge-label-card')].map(item=>item.classList.contains('edge-label-card')?item.parentElement:item).filter(label=>!label.hasAttribute('hidden'));
    this.world.querySelectorAll('.edge-label-leader').forEach(item=>item.remove());
    for(const label of labels){
      if(!this.labelOrigins.has(label))this.labelOrigins.set(label,label.getAttribute('transform')??'');
      else label.setAttribute('transform',this.labelOrigins.get(label));
    }
    const measurements=labels.map(label=>({label,bounds:label.getBoundingClientRect(),matrix:label.getScreenCTM(),card:Boolean(label.querySelector('.edge-label-card'))}));
    // Place wider cards before small ones, so narrow gaps remain usable.
    measurements.sort((a,b)=>Number(a.card)-Number(b.card)||(a.card?Math.round(b.bounds.width*b.bounds.height)-Math.round(a.bounds.width*a.bounds.height):0));
    const placements=[],worldInverse=worldMatrix.inverse();
    const occupied=new Map(),cellSize=64;
    const cells=rect=>{const keys=[];for(let x=Math.floor(rect.left/cellSize);x<=Math.floor(rect.right/cellSize);x++)for(let y=Math.floor(rect.top/cellSize);y<=Math.floor(rect.bottom/cellSize);y++)keys.push(`${x}/${y}`);return keys;};
    const reserve=rect=>{for(const key of cells(rect)){if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(rect);}};
    const measureOverlap=rect=>[...new Set(cells(rect).flatMap(key=>occupied.get(key)??[]))].reduce((sum,other)=>sum+Math.max(0,Math.min(rect.right,other.right+3)-Math.max(rect.left,other.left-3))*Math.max(0,Math.min(rect.bottom,other.bottom+3)-Math.max(rect.top,other.top-3)),0);
    for(const node of this.world.querySelectorAll('.node-symbol,.node-state'))reserve(node.getBoundingClientRect());
    for(const control of this.element.parentElement.querySelectorAll('#stage-controls button'))reserve(control.getBoundingClientRect());
    for(const {label,bounds,matrix,card} of measurements){
      if(!matrix)continue;
      // Occupancy stays fixed while choosing this label. Reuse the same
      // overlap result for scoring, expansion and the final clear-place filter.
      const overlaps=new WeakMap(),overlap=rect=>{if(!overlaps.has(rect))overlaps.set(rect,measureOverlap(rect));return overlaps.get(rect);};
      const positions=[];
      // Prefer a free segment of the same route before moving a card off its line.
      const edge=card&&label.closest('[data-edge]'),curve=edge&&this.curves.get(edge.dataset.edge);
      if(curve)for(const fraction of [.5,.4,.6,.3,.7,.2,.8]){
        const at=this.onCurve(curve,fraction),point=new DOMPoint(at.x,at.y).matrixTransform(worldMatrix);
        const left=bounds.left+point.x-matrix.e,top=bounds.top+point.y-matrix.f;
        if(left<area.left+3||left+bounds.width>area.right-3||top<area.top+3||top+bounds.height>area.bottom-3)continue;
        const rect={left,top,right:left+bounds.width,bottom:top+bounds.height};
        positions.push({rect,dx:left-bounds.left,dy:top-bounds.top,onPath:true,score:overlap(rect)*1000+Math.hypot(left-bounds.left,top-bounds.top)});
      }
      const offsets=[0,-1,1,-2,2];
      const addPosition=(x,y)=>{
        const left=Math.max(area.left+3,Math.min(area.right-3-bounds.width,x));
        const top=Math.max(area.top+3,Math.min(area.bottom-3-bounds.height,y));
        const rect={left,top,right:left+bounds.width,bottom:top+bounds.height};
        positions.push({rect,dx:left-bounds.left,dy:top-bounds.top,score:overlap(rect)*1000+Math.hypot(left-bounds.left,top-bounds.top)+(card&&(left!==bounds.left||top!==bounds.top)?80:0)});
      };
      const addPositions=values=>{for(const x of values)for(const y of values)addPosition(bounds.left+x*Math.max(12,bounds.width*.75),bounds.top+y*Math.max(12,bounds.height*.8));};
      addPositions(offsets);
      // Dense challenge routes may need more room than the nearby five positions.
      // Extend the search only when every nearby position still overlaps a part.
      if(positions.every(position=>overlap(position.rect)>0))addPositions([...offsets,-3,3,-4,4,-5,5,-6,6,-7,7,-8,8]);
      // A regular grid can miss a clear strip along the board's edge when
      // enlarged cards nearly fill it. Test the exact edge/obstacle boundaries.
      if(positions.every(position=>overlap(position.rect)>0)){
        const others=[...new Set([...occupied.values()].flat())],xs=[area.left+3,area.right-3-bounds.width],ys=[area.top+3,area.bottom-3-bounds.height];
        for(const x of xs)for(const y of [...ys,...others.flatMap(rect=>[rect.top-bounds.height-4,rect.bottom+4])])addPosition(x,y);
        for(const y of ys)for(const x of others.flatMap(rect=>[rect.left-bounds.width-4,rect.right+4]))addPosition(x,y);
        // Interior gaps can lie between two labels without touching a board edge.
        if(positions.every(position=>overlap(position.rect)>0)){
          const innerX=[...new Set(others.flatMap(rect=>[rect.left-bounds.width-4,rect.right+4]).map(x=>Math.max(area.left+3,Math.min(area.right-3-bounds.width,x))))];
          const innerY=[...new Set(others.flatMap(rect=>[rect.top-bounds.height-4,rect.bottom+4]).map(y=>Math.max(area.top+3,Math.min(area.bottom-3-bounds.height,y))))];
          for(const x of innerX)for(const y of innerY)addPosition(x,y);
        }
      }
      const clearPositions=positions.filter(position=>overlap(position.rect)===0);
      const best=(clearPositions.length?clearPositions:positions).reduce((a,b)=>a.score<=b.score?a:b),inverse=matrix.inverse();
      const placement={label,transform:`${this.labelOrigins.get(label)} translate(${inverse.a*best.dx+inverse.c*best.dy} ${inverse.b*best.dx+inverse.d*best.dy})`};
      if(card&&!best.onPath&&Math.hypot(best.dx,best.dy)>8){
        const origin=new DOMPoint(matrix.e,matrix.f).matrixTransform(worldInverse),end=new DOMPoint((best.rect.left+best.rect.right)/2,(best.rect.top+best.rect.bottom)/2).matrixTransform(worldInverse);
        placement.leader=`M${origin.x} ${origin.y} L${end.x} ${end.y}`;
      }
      placements.push(placement);
      reserve(best.rect);
    }
    for(const {label,transform,leader} of placements){label.setAttribute('transform',transform);if(leader)label.parentElement.insertBefore(svg('path',{d:leader,class:'edge-label-leader'}),label);}
  }
  renderArrivals() {
    const run=this.session.run;
    if(this.pictureRun!==run||run?.status==='stopped'){this.arrivalPictures.clear();this.pictureRun=run;}
    for(const art of this.effectsLayer.querySelectorAll('[data-arrival-key]'))if(!this.arrivalPictures.has(art.dataset.arrivalKey))art.remove();
    const now=performance.now();
    for(const [id,picture] of this.arrivalPictures){
      if(now-picture.at>=picture.duration){this.arrivalPictures.delete(id);this.effectsLayer.querySelector(`[data-arrival-key="${CSS.escape(id)}"]`)?.remove();continue;}
      if(this.effectsLayer.querySelector(`[data-arrival-key="${CSS.escape(id)}"]`))continue;
      const node=run.circuit.nodes.get(picture.node),draw=picture.kind==='prism'?prismArrival:constellation;
      const art=draw(this.position(node),this.fontFactor??1,this.angle,picture.particle,Math.max(0,now-picture.at));
      art.setAttribute('data-arrival-key',id);art.setAttribute('data-arrival-node',picture.node);
      this.effectsLayer.append(art);
    }
    this.placeConstellations();
  }
  placeConstellations() {
    if(!this.effectsLayer.querySelector('.bell-constellation'))return;
    const area=this.element.getBoundingClientRect(),pad=8;
    if(area.width<1||area.height<1)return;
    const occupied=[...this.world.querySelectorAll('.node-symbol'),...document.querySelectorAll('#stage-controls button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>e.getBoundingClientRect());
    const labels=[...this.world.querySelectorAll('.node-name,.edge-label-card')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).map(e=>e.getBoundingClientRect());
    const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    // Measure all existing artwork before writing any placements. Repeated SVG
    // read/write cycles otherwise force a full layout for each concurrent bell.
    const motifs=[...this.effectsLayer.querySelectorAll('.bell-constellation')].map(motif=>{
      const art=motif.parentElement,target=this.world.querySelector(`[data-node="${CSS.escape(art.dataset.arrivalNode)}"] .node-symbol`),matrix=art.getScreenCTM();
      return target&&matrix?{motif,matrix,bell:target.getBoundingClientRect()}:null;
    }).filter(Boolean),placements=[];
    for(const {motif,matrix,bell} of motifs){
      const cx=(bell.left+bell.right)/2,cy=(bell.top+bell.bottom)/2;
      const maximum=Math.min(156,area.height-2*pad,(area.width-2*pad)/.88),heights=[maximum,maximum*.85,maximum*.7,maximum*.55,maximum*.4,maximum*.25,maximum*.18,maximum*.12];
      let best=null,bestCost=Infinity;
      for(const height of heights){
        const width=height*.88;
        const positions=[[cx-width/2,bell.top-12-height],[bell.right+12,cy-height/2],[bell.left-12-width,cy-height/2]];
        if(height<=maximum*.4)positions.push([cx-width/2,bell.bottom+12],[area.left+pad,bell.bottom+12],[area.right-pad-width,bell.bottom+12],[area.left+pad,area.top+pad],[area.right-pad-width,area.top+pad],[area.left+pad,area.bottom-pad-height],[area.right-pad-width,area.bottom-pad-height]);
        if(height<=maximum*.18)for(let step=0;step<=24;step++)for(const x of [area.left+pad,area.right-pad-width])positions.push([x,area.top+pad+(area.height-height-pad*2)*step/24]);
        for(const [x,y] of positions){
          const rect={left:x,top:y,right:x+width,bottom:y+height};
          if(x<area.left+pad||y<area.top+pad||rect.right>area.right-pad||rect.bottom>area.bottom-pad)continue;
          const clearance=Math.max(2,height*.03+1),cost=occupied.reduce((sum,r)=>sum+overlap(rect,{left:r.left-clearance,right:r.right+clearance,top:r.top-clearance,bottom:r.bottom+clearance}),0)*100000+labels.reduce((sum,r)=>sum+overlap(rect,r),0);
          if(cost<bestCost){best=rect;bestCost=cost;}
          if(cost===0)break;
        }
        if(bestCost===0)break;
      }
      // An exceptionally small view still gets the complete silhouette, never a crop.
      best??={left:area.left+pad,top:area.top+pad,right:area.left+pad+maximum*.88,bottom:area.top+pad+maximum};
      const center=new DOMPoint((best.left+best.right)/2,(best.top+best.bottom)/2).matrixTransform(matrix.inverse()),scale=(best.bottom-best.top)/400/Math.hypot(matrix.a,matrix.b);
      placements.push({motif,transform:`translate(${center.x} ${center.y}) scale(${scale})`});
      occupied.push(best);
    }
    for(const {motif,transform} of placements)motif.setAttribute('transform',transform);
  }
  arrivals(entries) {
    if(this.pictureRun!==this.session.run){this.arrivalPictures.clear();this.pictureRun=this.session.run;}
    for(const entry of entries){
      const kind=this.session.run.circuit.nodes.get(entry.node)?.kind;
      if(entry.type!=='goal'&&!(entry.type==='arrival'&&kind==='prism'))continue;
      const id=`${entry.particle}:${entry.node}:${entry.time}`,duration=ARRIVAL_DURATION_MS[kind];
      this.arrivalPictures.set(id,{node:entry.node,particle:entry.particle,kind,at:performance.now(),duration});
      const run=this.session.run;
      setTimeout(()=>{if(this.pictureRun===run){this.arrivalPictures.delete(id);this.effectsLayer.querySelector(`[data-arrival-key="${CSS.escape(id)}"]`)?.remove();}},duration);
    }
    this.renderArrivals();
  }
  onCurve({a,b,control},fraction) {
    const r=1-fraction;return {x:r*r*a.x+2*r*fraction*control.x+fraction*fraction*b.x,y:r*r*a.y+2*r*fraction*control.y+fraction*fraction*b.y};
  }
  updateGoalMarkers() {
    const run=this.session.run;
    let history=run&&this.goalHistories.get(run);
    if(run&&!history){history={circuit:this.session.circuit,cursor:0,counts:new Map(),last:new Set(),time:null};this.goalHistories.set(run,history);}
    if(history)for(;history.cursor<run.records.length;history.cursor++){
      const entry=run.records[history.cursor];if(entry.type!=='goal')continue;
      history.counts.set(entry.node,(history.counts.get(entry.node)??0)+1);
      if(history.time!==entry.time){history.last.clear();history.time=entry.time;}
      history.last.add(entry.node);
    }
    const visible=history&&(run.status!=='stopped'||history.circuit===this.session.circuit);
    for(const group of this.world.querySelectorAll('.goal')){
      const id=group.dataset.node,count=visible?(history.counts.get(id)??0):0,last=count>0&&history.last.has(id),state=`${count}:${last}`;
      if(group.dataset.arrivalState===state)continue;group.dataset.arrivalState=state;
      group.classList.toggle('has-arrived',count>0);group.classList.toggle('last-arrival',last);group.dataset.arrivalCount=count;
      group.setAttribute('aria-label',group.dataset.baseLabel+(count?`、到達${count}回${last?'、最後の到達':''}`:''));
    }
  }
  particles() {
    this.particleLayer.replaceChildren();
    const run=this.session.run;
    this.updateGoalMarkers();
    if(!run||run.status==='stopped'){if(this.timeLayoutSignature!==''){this.timeLayoutSignature='';this.fitTimeLabels();}return;}
    const states=[];
    for(const group of this.world.querySelectorAll('[data-node]')){
      const existing=group.querySelector('.node-state'),gate=run.gates.get(group.dataset.node),waiting=gate.queue.length-gate.head;
      if(waiting||gate.current!==null){const text=`${gate.current!==null?'処理中':''}${waiting?' 待ち'+waiting:''}`;states.push(`${group.dataset.node}:${text}`);if(existing){if(existing.textContent!==text)existing.textContent=text;}else group.append(svg('text',{y:(group.classList.contains('source')?-160:130)*(this.fontFactor??1),class:'node-state'},text));}
      else existing?.remove();
    }
    const signature=states.join('/');if(this.timeLayoutSignature!==signature){this.timeLayoutSignature=signature;this.fitTimeLabels();}
    for(const particle of run.particles.values()) {
      let at;
      if(particle.status==='moving') {
        const curve=this.curves.get(particle.edge); if(!curve)continue;
        // Calculate a bounded ratio without turning huge absolute times into Numbers.
        const travelled=run.clock-particle.departed,duration=particle.due-particle.departed;
        const fraction=Number(travelled*10000n/duration)/10000;
        const directed=particle.from===run.circuit.edges.get(particle.edge).from?curve:{a:curve.b,b:curve.a,control:curve.control};
        at=this.onCurve(directed,fraction);
        const tail=this.onCurve(directed,Math.max(0,fraction-.045));
        this.particleLayer.append(svg('path',{d:`M${tail.x} ${tail.y} L${at.x} ${at.y}`,class:'light-trail'}));
      } else if(['waiting','processing','deadend'].includes(particle.status)) at=this.position(run.circuit.nodes.get(particle.node));
      else continue;
      const radius=this.particleRadius??18,active=particle.status!=='deadend';
      const light=svg('g',{class:`light-particle ${particle.status}`,transform:`translate(${at.x} ${at.y})`,'aria-hidden':'true'});
      if(active)light.append(svg('circle',{r:radius*3,class:'particle-glow'}));
      light.append(svg('circle',{r:radius,class:`particle ${particle.status}`}));
      if(active)light.append(svg('circle',{cx:-radius*.25,cy:-radius*.25,r:radius*.3,class:'particle-spark'}));
      this.particleLayer.append(light);
    }
  }
  down(event) {
    if(event.button!==0)return;event.preventDefault();this.element.setPointerCapture(event.pointerId);
    this.stopHold();
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pointers.size>=2){if(this.pointers.size===2)this.gesture={kind:'pinch',distance:this.distance(),center:this.pointerCenter()};this.wire?.setAttribute('d','');this.magnifier.hide();return;}
    const directEdge=event.target.closest('[data-edge]');
    const directNode=event.target.closest('[data-node]')?.dataset.node??(!directEdge&&!this.addKind&&this.session.editable?this.wireTarget(event.clientX,event.clientY):null);
    const card=event.target.closest('.edge-label')&&directEdge&&!directEdge.classList.contains('candidate');
    const edge=directNode?null:card?directEdge.dataset.edge:this.edgeTarget(event.clientX,event.clientY)??directEdge?.dataset.edge;
    const node=directNode??(!edge&&!this.addKind&&this.session.editable?this.wireTarget(event.clientX,event.clientY):null);
    if(node&&this.session.editable&&this.session.mode==='challenge')this.session.view.showAllTimes=false;
    if(node||edge){this.session.selection=node??edge;this.render();this.changed(false);}
    const matrix=this.world.getScreenCTM().inverse(), at=this.location(event.clientX,event.clientY,matrix);
    this.gesture={kind:event.target.dataset.move?'move':node?'wire':event.pointerType==='touch'?'idle':'pan',id:node??edge,route:node?[node]:[],start:at,last:at,x:event.clientX,y:event.clientY,matrix,moved:false,panX:this.session.view.panX,panY:this.session.view.panY};
    if(edge&&!node&&!this.addKind&&this.session.editable&&this.session.circuit.edges.some(item=>item.id===edge)){
      const gesture=this.gesture;
      this.holdTimer=setTimeout(()=>{
        this.holdTimer=null;
        if(this.gesture!==gesture||gesture.moved||this.pointers.size!==1||!this.session.editable)return;
        gesture.kind='held';this.lastTap=null;this.requestDelete(edge,event);
      },550);
    }
    if(node&&this.session.editable)this.magnifier.show(event,`${objectName(node,this.session.circuit)}から結線`);
  }
  distance() {const [a,b]=[...this.pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
  pointerCenter() {const [a,b]=[...this.pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  edgeTarget(x,y) {
    const matrix=this.world.getScreenCTM();if(!matrix)return null;
    let nearest=null,distance=14;
    const point=({x,y})=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f});
    for(const edge of this.session.circuit.edges){
      const curve=this.curves.get(edge.id);if(!curve)continue;let previous=point(curve.a);
      for(let n=1;n<=16;n++){
        const current=point(this.onCurve(curve,n/16));
        const dx=current.x-previous.x,dy=current.y-previous.y,length=dx*dx+dy*dy,fraction=length?Math.max(0,Math.min(1,((x-previous.x)*dx+(y-previous.y)*dy)/length)):0;
        const gap=Math.hypot(x-previous.x-dx*fraction,y-previous.y-dy*fraction);
        if(gap<distance){distance=gap;nearest=edge.id;}previous=current;
      }
    }
    return nearest;
  }
  wireTarget(x,y,{route=null,final=false}={}) {
    const from=route?.at(-1),terminal=route?.length>1&&this.session.circuit.nodes.find(n=>n.id===from)?.kind==='goal';
    let nearest=null,distance=Infinity;
    for(const group of this.world.querySelectorAll('[data-node]')){
      const id=group.dataset.node,hit=group.querySelector('.node-hit')?.getBoundingClientRect();if(!hit?.width||!hit.height)continue;
      const radius=Math.min(hit.width,hit.height)/2;
      const tolerance=route?(final?radius+WIRING_HIT.releaseMargin:Math.min(WIRING_HIT.passMax,Math.max(WIRING_HIT.passMin,radius*.7))):radius+WIRING_HIT.startMargin;
      const gap=Math.hypot(x-hit.left-hit.width/2,y-hit.top-hit.height/2);
      if(gap>tolerance||gap>=distance)continue;
      if(route&&id!==from){if(terminal)continue;try{this.session.planConnections([...route,id]);}catch{continue;}}
      nearest=id;distance=gap;
    }
    return nearest;
  }
  move(event,final=false) {
    if(!this.pointers.has(event.pointerId)||!this.gesture)return;
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const gesture=this.gesture;
    if(gesture.kind==='pinch') {
      if(this.pointers.size<2)return;const distance=this.distance(),center=this.pointerCenter(),matrix=this.world.getScreenCTM().inverse();
      // Two fingers move the view deliberately; one finger remains for wiring.
      const dx=center.x-gesture.center.x,dy=center.y-gesture.center.y,zoom=this.session.view.zoom;
      this.session.view.panX+=(matrix.a*dx+matrix.c*dy)*zoom;this.session.view.panY+=(matrix.b*dx+matrix.d*dy)*zoom;this.transform();
      if(gesture.distance>0)this.zoom(distance/gesture.distance,center.x,center.y);gesture.distance=distance;gesture.center=center;return;
    }
    const threshold=event.pointerType==='touch'&&this.session.circuit.edges.some(edge=>edge.id===gesture.id)?12:7;
    gesture.moved ||= Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>threshold;
    if(gesture.moved)this.stopHold();
    gesture.last=this.location(event.clientX,event.clientY,gesture.matrix);
    if(gesture.kind==='pan'&&gesture.moved) {
      const zoom=this.session.view.zoom;this.session.view.panX=gesture.panX+(gesture.last.x-gesture.start.x)*zoom;this.session.view.panY=gesture.panY+(gesture.last.y-gesture.start.y)*zoom;this.transform();
    } else if(gesture.kind==='wire'&&gesture.moved&&this.session.editable) {
      const target=this.wireTarget(event.clientX,event.clientY,{route:gesture.route,final});
      const from=gesture.route.at(-1),terminal=gesture.route.length>1&&this.session.circuit.nodes.find(n=>n.id===from)?.kind==='goal';
      if(final)gesture.releaseTarget=target;
      if(target&&target!==from&&!terminal){
        // Cue each accepted target; the stroke stays provisional until release.
        try{this.session.planConnections([...gesture.route,target]);gesture.route.push(target);this.session.selection=target;this.connected(target);this.render();this.changed(false);}catch{/* An invalid intermediate target does not commit part of the stroke. */}
      }
      this.previewWire();this.magnifier.show(event,`${gesture.route.map(id=>partName(this.session.circuit.nodes.find(node=>node.id===id),this.session.circuit.nodes,true)).join('→')}`);
    } else if(gesture.kind==='move'&&gesture.moved&&this.session.editable) {
      const group=this.world.querySelector(`[data-node="${CSS.escape(gesture.id)}"]`);
      group?.setAttribute('transform',`translate(${gesture.last.x} ${gesture.last.y}) rotate(${-this.angle})`);
      this.magnifier.show(event,`${objectName(gesture.id,this.session.circuit)}を移動`);
    }
  }
  previewWire() {
    const gesture=this.gesture;if(!this.wire||gesture?.kind!=='wire'||!gesture.moved)return;
    const points=gesture.route.map(id=>this.position(this.session.circuit.nodes.find(n=>n.id===id)));
    points.push(gesture.last);this.wire.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '));
  }
  up(event) {
    this.stopHold();
    this.move(event,true);const gesture=this.gesture;this.pointers.delete(event.pointerId);this.magnifier.hide();
    if(!gesture||gesture.kind==='held'){this.gesture=null;return;}
    if(gesture.kind==='pinch'){if(this.pointers.size===0)this.cancelAll();return;}
    this.gesture=null;this.wire?.setAttribute('d','');
    try {
      if(gesture.kind==='wire'&&gesture.moved&&this.session.editable) {
        if(gesture.route.length>1&&gesture.releaseTarget===gesture.route.at(-1)){
          this.session.connectPath(gesture.route);
        }
      } else if(gesture.kind==='move'&&gesture.moved&&this.session.editable) {const at=this.coordinates(gesture.last);this.session.moveNode(gesture.id,at.x,at.y);}
      else if(!gesture.moved) {
        if(this.addKind&&['pan','idle'].includes(gesture.kind)&&!gesture.id){const at=this.coordinates(gesture.last);this.session.addNode(this.addKind,at.x,at.y);this.addKind=null;}
        else if(gesture.id) {
          const now=performance.now();
          const built=this.session.circuit.edges.some(edge=>edge.id===gesture.id);
          if(built||(this.lastTap?.id===gesture.id&&now-this.lastTap.time<400)){this.lastTap=null;this.openSettings(event);}
          else this.lastTap={id:gesture.id,time:now};
        }
      }
    } catch(error){this.notify(error.message);}
    this.render();this.changed();
  }
  cancel(event) {this.pointers.delete(event.pointerId);this.cancelAll();this.render();}
  stopHold() {clearTimeout(this.holdTimer);this.holdTimer=null;}
  cancelAll() {this.stopHold();this.gesture=null;this.pointers.clear();this.lastTap=null;this.wire?.setAttribute('d','');this.magnifier.hide();}
}
