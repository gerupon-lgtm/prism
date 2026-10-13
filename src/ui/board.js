import { svg } from './svg.js';
import { Scene,symbol,constellation } from './scene.js';
import { Magnifier } from './magnifier.js';

// Display only; inverse projection keeps saved/edit coordinates unchanged.
const CIRCUIT_WIDTH = 1.5;
const secondsLabel=value=>`${value.length>4?value.slice(0,2)+'…':value}s`;

export class Board {
  constructor(element, session, changed, openSettings, notify) {
    Object.assign(this,{element,session,changed,openSettings,notify});
    this.orientation = svg('g',{class:'board-orientation',id:'board-detail'}); this.world = svg('g'); this.particleLayer = svg('g');this.effectsLayer=svg('g',{class:'arrival-layer'});
    this.orientation.append(this.effectsLayer,this.world,this.particleLayer); element.append(this.orientation);
    this.scene=new Scene(element);this.arrivalPictures=new Map();this.pictureRun=null;
    this.magnifier=new Magnifier(this);
    this.pointers = new Map(); this.gesture = null; this.lastTap = null; this.addKind = null;
    element.addEventListener('pointerdown',event=>this.down(event));
    element.addEventListener('pointermove',event=>this.move(event));
    element.addEventListener('pointerup',event=>this.up(event));
    element.addEventListener('pointercancel',event=>this.cancel(event));
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
    if(screenMatrix){const scale=Math.hypot(screenMatrix.a,screenMatrix.b);this.fontFactor=Math.max(1,0.5/scale);this.element.style.setProperty('--board-factor',this.fontFactor);}
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
  fit() {
    const input=this.session.run&&this.session.run.status!=='stopped'?this.session.run.circuit.raw:this.session.circuit;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const node of input.nodes){const at=this.position(node);minX=Math.min(minX,at.x);minY=Math.min(minY,at.y);maxX=Math.max(maxX,at.x);maxY=Math.max(maxY,at.y);}
    const zoom=Math.min(6,(this.frameWidth??1360)*1000/1360/(maxX-minX+250),1600/(maxY-minY+300));
    Object.assign(this.session.view,{zoom,panX:500-(minX/2+maxX/2)*zoom,panY:800-(minY/2+maxY/2)*zoom});this.transform();this.render();
  }
  render() {
    this.world.replaceChildren(); this.curves = new Map(); this.transform();
    const kind=this.session.mode==='free'?'sky':Number(this.session.challenge.id.slice(1))<=3?'ruins':'observatory';
    const sceneWidth=(this.frameWidth??1360)*.85;
    this.scene.draw(sceneWidth,1600,kind);this.scene.root.setAttribute('transform',`translate(${500-sceneWidth/2} 0)`);
    const input=this.session.run && this.session.run.status!=='stopped' ? this.session.run.circuit.raw : this.session.circuit;
    let extent=1;for(const node of input.nodes)extent=Math.max(extent,Math.abs(node.x??0.5),Math.abs(node.y??0.5));
    // Display projection only; original coordinates are retained in circuit files.
    this.projectionScale=extent>1000?extent:1;
    const nodes=new Map(input.nodes.map(node=>[node.id,node]));
    const candidates=this.session.mode==='challenge' ? this.session.challenge.candidates.filter(edge=>!input.edges.some(built=>built.id===edge.id)) : [];
    const all=[...input.edges,...candidates];
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
      const group=svg('g',{'data-edge':edge.id,class:`edge${candidate?' candidate':''}${disabled?' unavailable':''}${this.session.selection===edge.id?' selected':''}`});
      group.append(svg('title',{},`${edge.from} ${edge.bidirectional?'↔':'→'} ${edge.to}：${edge.time}秒`));
      const d=`M${a.x},${a.y} Q${control.x},${control.y} ${b.x},${b.y}`;
      group.append(svg('path',{d,class:'edge-hit'}),svg('path',{d,class:'edge-line'}));
      // Stagger parallel labels along the path, rather than stacking at its midpoint.
      const progress=parallel.length>1?.32+.36*at/(parallel.length-1):.5;
      const middle=this.onCurve(curve,edge.from<edge.to?progress:1-progress), label=svg('g',{transform:`translate(${middle.x} ${middle.y}) rotate(${-this.angle})`});
      const factor=this.fontFactor??1,card=svg('rect',{class:'edge-label-card',rx:10*factor}),text=svg('text',{y:0,class:'edge-time'},`${secondsLabel(edge.time)} ${edge.bidirectional?'↔':'→'}`);
      label.append(card,text);group.append(label);
      this.world.append(group);
      timeCards.push({card,text,factor});
    }
    for (const node of input.nodes) {
      const at=this.position(node),selected=this.session.selection===node.id;
      const group=svg('g',{'data-node':node.id,class:`node ${node.kind}${selected?' selected':''}${node.enabled===false?' unavailable':''}`,transform:`translate(${at.x} ${at.y}) rotate(${-this.angle})`,tabindex:0,role:'button','aria-label':`${node.name??node.id} ${node.kind==='goal'?'祭壇':node.kind==='source'?'出発点':'プリズム'}${node.enabled===false?' 使用不可':''}`});
      const factor=this.fontFactor??1;
      group.append(svg('circle',{r:65*factor,class:'node-hit'}));
      group.append(symbol(node.kind,factor));
      if(node.enabled===false)group.append(svg('path',{d:`M${-28*factor} ${-28*factor} L${28*factor} ${28*factor} M${28*factor} ${-28*factor} L${-28*factor} ${28*factor}`,class:'disabled-mark'}));
      const label=node.name??node.id;
      group.append(svg('title',{},`${label}${node.kind==='goal'?'':`：${node.process}秒${node.kind==='source'?'（戻り）':''}`}`),svg('text',{y:(node.kind==='goal'?-50:8)*factor,class:'node-name'},label.length>8?`${label.slice(0,7)}…`:label));
      if(node.kind!=='goal'){
        const text=svg('text',{y:(node.kind==='source'?-92:64)*factor,class:'node-time'},secondsLabel(node.process));
        if(node.kind==='source')text.append(svg('tspan',{x:0,dy:30*factor,class:'source-time-note'},'戻り'));
        group.append(text);
      }
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
    this.renderArrivals();
  }
  fitTimeLabels() {
    const worldMatrix=this.world.getScreenCTM();
    if(!worldMatrix)return;
    const area=this.element.getBoundingClientRect();
    const labels=[...this.world.querySelectorAll('.node-time'),...this.world.querySelectorAll('.edge-label-card')].map(item=>item.classList.contains('edge-label-card')?item.parentElement:item);
    this.world.querySelectorAll('.edge-label-leader').forEach(item=>item.remove());
    for(const label of labels){
      if(!this.labelOrigins.has(label))this.labelOrigins.set(label,label.getAttribute('transform')??'');
      else label.setAttribute('transform',this.labelOrigins.get(label));
    }
    const measurements=labels.map(label=>({label,bounds:label.getBoundingClientRect(),matrix:label.getScreenCTM(),card:Boolean(label.querySelector('.edge-label-card'))}));
    const placements=[],worldInverse=worldMatrix.inverse();
    const occupied=new Map(),cellSize=64;
    const cells=rect=>{const keys=[];for(let x=Math.floor(rect.left/cellSize);x<=Math.floor(rect.right/cellSize);x++)for(let y=Math.floor(rect.top/cellSize);y<=Math.floor(rect.bottom/cellSize);y++)keys.push(`${x}/${y}`);return keys;};
    const reserve=rect=>{for(const key of cells(rect)){if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(rect);}};
    const overlap=rect=>[...new Set(cells(rect).flatMap(key=>occupied.get(key)??[]))].reduce((sum,other)=>sum+Math.max(0,Math.min(rect.right,other.right+3)-Math.max(rect.left,other.left-3))*Math.max(0,Math.min(rect.bottom,other.bottom+3)-Math.max(rect.top,other.top-3)),0);
    for(const node of this.world.querySelectorAll('.node-symbol,.node-name,.node-state'))reserve(node.getBoundingClientRect());
    for(const {label,bounds,matrix,card} of measurements){
      if(!matrix)continue;
      const positions=[];
      for(const x of [0,-1,1,-2,2])for(const y of [0,-1,1,-2,2]){
        const left=Math.max(area.left+3,Math.min(area.right-3-bounds.width,bounds.left+x*Math.max(12,bounds.width*.75)));
        const top=Math.max(area.top+3,Math.min(area.bottom-3-bounds.height,bounds.top+y*Math.max(12,bounds.height*.8)));
        const rect={left,top,right:left+bounds.width,bottom:top+bounds.height};
        positions.push({rect,dx:left-bounds.left,dy:top-bounds.top,score:overlap(rect)*1000+Math.hypot(left-bounds.left,top-bounds.top)});
      }
      const best=positions.reduce((a,b)=>a.score<=b.score?a:b),inverse=matrix.inverse();
      const placement={label,transform:`${this.labelOrigins.get(label)} translate(${inverse.a*best.dx+inverse.c*best.dy} ${inverse.b*best.dx+inverse.d*best.dy})`};
      if(card&&Math.hypot(best.dx,best.dy)>8){
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
    this.effectsLayer.replaceChildren();
    const now=performance.now();
    for(const [id,picture] of this.arrivalPictures){
      if(now-picture.at>=1300){this.arrivalPictures.delete(id);continue;}
      const node=run.circuit.nodes.get(picture.node),art=constellation(this.position(node),this.fontFactor??1,this.angle,id);
      art.style.animationDelay=`-${Math.max(0,now-picture.at)}ms`;this.effectsLayer.append(art);
    }
  }
  arrivals(entries) {
    if(this.pictureRun!==this.session.run){this.arrivalPictures.clear();this.pictureRun=this.session.run;}
    for(const entry of entries)if(entry.type==='goal'){
      this.arrivalPictures.set(entry.particle,{node:entry.node,at:performance.now()});
      const run=this.session.run,id=entry.particle;
      setTimeout(()=>{if(this.pictureRun===run){this.arrivalPictures.delete(id);this.effectsLayer.querySelector(`[data-arrived-particle="${id}"]`)?.remove();}},1300);
    }
    this.renderArrivals();
  }
  onCurve({a,b,control},fraction) {
    const r=1-fraction;return {x:r*r*a.x+2*r*fraction*control.x+fraction*fraction*b.x,y:r*r*a.y+2*r*fraction*control.y+fraction*fraction*b.y};
  }
  particles() {
    this.particleLayer.replaceChildren();
    const run=this.session.run;
    if(!run||run.status==='stopped'){if(this.timeLayoutSignature!==''){this.timeLayoutSignature='';this.fitTimeLabels();}return;}
    const states=[];
    for(const group of this.world.querySelectorAll('[data-node]')){
      group.querySelector('.node-state')?.remove();const gate=run.gates.get(group.dataset.node),waiting=gate.queue.length-gate.head;
      if(waiting||gate.current!==null){const text=`${gate.current!==null?'処理中':''}${waiting?' 待ち'+waiting:''}`;states.push(`${group.dataset.node}:${text}`);group.append(svg('text',{y:(group.classList.contains('source')?-150:100)*(this.fontFactor??1),class:'node-state'},text));}
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
      this.particleLayer.append(svg('circle',{cx:at.x,cy:at.y,r:particle.status==='deadend'?16:11,class:`particle ${particle.status}`}));
    }
  }
  down(event) {
    if(event.button!==0)return;event.preventDefault();this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pointers.size>=2){if(this.pointers.size===2)this.gesture={kind:'pinch',distance:this.distance()};this.wire?.setAttribute('d','');this.magnifier.hide();return;}
    const node=event.target.closest('[data-node]')?.dataset.node,edge=event.target.closest('[data-edge]')?.dataset.edge;
    if(node||edge){this.session.selection=node??edge;this.render();this.changed(false);}
    const matrix=this.world.getScreenCTM().inverse(), at=this.location(event.clientX,event.clientY,matrix);
    this.gesture={kind:event.target.dataset.move?'move':node?'wire':'pan',id:node??edge,route:node?[node]:[],start:at,last:at,x:event.clientX,y:event.clientY,matrix,moved:false,panX:this.session.view.panX,panY:this.session.view.panY};
    if(node&&this.session.editable)this.magnifier.show(event,`${node}から結線`);
  }
  distance() {const [a,b]=[...this.pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
  move(event,final=false) {
    if(!this.pointers.has(event.pointerId)||!this.gesture)return;
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const gesture=this.gesture;
    if(gesture.kind==='pinch') {
      if(this.pointers.size<2)return; const distance=this.distance(),[a,b]=[...this.pointers.values()];
      if(gesture.distance>0)this.zoom(distance/gesture.distance,(a.x+b.x)/2,(a.y+b.y)/2);gesture.distance=distance;return;
    }
    gesture.moved ||= Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7;
    gesture.last=this.location(event.clientX,event.clientY,gesture.matrix);
    if(gesture.kind==='pan'&&gesture.moved) {
      const zoom=this.session.view.zoom;this.session.view.panX=gesture.panX+(gesture.last.x-gesture.start.x)*zoom;this.session.view.panY=gesture.panY+(gesture.last.y-gesture.start.y)*zoom;this.transform();
    } else if(gesture.kind==='wire'&&gesture.moved&&this.session.editable) {
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-node]')?.dataset.node;
      const from=gesture.route.at(-1),terminal=gesture.route.length>1&&this.session.circuit.nodes.find(n=>n.id===from)?.kind==='goal';
      const hit=target?this.world.querySelector(`[data-node="${CSS.escape(target)}"] .node-hit`)?.getBoundingClientRect():null;
      // Pass near the centre for an intermediate point. The larger hit region
      // still accepts a final release without turning a nearby pass into a detour.
      const near=hit&&Math.hypot(event.clientX-hit.left-hit.width/2,event.clientY-hit.top-hit.height/2)<=Math.min(hit.width,hit.height)*.2;
      if(target&&target!==from&&!terminal&&(final||near)){
        try{this.session.planConnections([...gesture.route,target]);gesture.route.push(target);this.session.selection=target;this.render();this.changed(false);}catch{/* An invalid intermediate target does not commit part of the stroke. */}
      }
      this.previewWire();this.magnifier.show(event,`${gesture.route.join('→')}`);
    } else if(gesture.kind==='move'&&gesture.moved&&this.session.editable) {
      const group=this.world.querySelector(`[data-node="${CSS.escape(gesture.id)}"]`);
      group?.setAttribute('transform',`translate(${gesture.last.x} ${gesture.last.y}) rotate(${-this.angle})`);
      this.magnifier.show(event,`${gesture.id}を移動`);
    }
  }
  previewWire() {
    const gesture=this.gesture;if(!this.wire||gesture?.kind!=='wire'||!gesture.moved)return;
    const points=gesture.route.map(id=>this.position(this.session.circuit.nodes.find(n=>n.id===id)));
    points.push(gesture.last);this.wire.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '));
  }
  up(event) {
    this.move(event,true);const gesture=this.gesture;this.pointers.delete(event.pointerId);this.magnifier.hide();
    if(!gesture)return;
    if(gesture.kind==='pinch'){if(this.pointers.size===0)this.cancelAll();return;}
    this.gesture=null;this.wire?.setAttribute('d','');
    try {
      if(gesture.kind==='wire'&&gesture.moved&&this.session.editable) {
        const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-node]')?.dataset.node;
        if(gesture.route.length>1&&target===gesture.route.at(-1))this.session.connectPath(gesture.route);
      } else if(gesture.kind==='move'&&gesture.moved&&this.session.editable) {const at=this.coordinates(gesture.last);this.session.moveNode(gesture.id,at.x,at.y);}
      else if(!gesture.moved) {
        if(this.addKind&&gesture.kind==='pan'&&!gesture.id){const at=this.coordinates(gesture.last);this.session.addNode(this.addKind,at.x,at.y);this.addKind=null;}
        else if(gesture.id) {
          const now=performance.now();
          if(this.lastTap?.id===gesture.id&&now-this.lastTap.time<400){this.lastTap=null;this.openSettings();}
          else this.lastTap={id:gesture.id,time:now};
        }
      }
    } catch(error){this.notify(error.message);}
    this.render();this.changed();
  }
  cancel(event) {this.pointers.delete(event.pointerId);this.cancelAll();this.render();}
  cancelAll() {this.gesture=null;this.pointers.clear();this.lastTap=null;this.wire?.setAttribute('d','');this.magnifier.hide();}
}
