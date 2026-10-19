// Authored SET-04 graphs. IDs Q23..Q28 are distinct from the displayed Q19..Q24.
const n=(id,kind,x,y,process='0.5')=>({id,kind,x,y,process:kind==='goal'?'0':process});
const s=()=>n('S','source',.5,.07),p=(id,x,y,t)=>n(id,'prism',x,y,t),g=(id,x,y)=>n(id,'goal',x,y);
const e=(from,to,time)=>({id:from+to,from,to,time:String(time)});
const two=()=>[s(),p('A',.5,.29),p('B',.19,.53),p('C',.81,.53),p('D',.5,.72),g('G1',.22,.95),g('G2',.78,.95)];
const three=()=>[s(),p('A',.5,.27),p('B',.2,.49),p('C',.8,.49),p('D',.27,.72),p('E',.73,.72),g('G1',.16,.96),g('G2',.5,.96),g('G3',.84,.96)];
const routes=()=>[e('S','A',.5),e('A','B',.5),e('A','C',1),e('B','D',.5),e('C','E',.5),e('D','G1',.5),e('D','G2',1.5),e('E','G2',1),e('E','G3',1.5),e('B','E',1.5),e('C','D',2),e('B','G1',2.5),e('C','G3',3)];
const relayNodes=()=>[s(),p('A',.5,.27),p('C',.82,.43),p('B',.5,.55),p('D',.24,.73),p('E',.76,.73),g('G1',.16,.96),g('G2',.5,.96),g('G3',.84,.96)];
const relayRoutes=()=>[e('S','A',.5),e('A','B',3),e('A','C',.5),e('C','B',.5),e('B','D',.5),e('B','E',.5),e('D','G1',.5),e('D','G2',1.5),e('E','G2',1),e('E','G3',2.5),e('C','G3',3),e('A','G1',4),e('A','E',4)];
export const sequenceChallenges=[
 {id:'Q23',version:1,name:'ふたつの鐘の呼び声',type:'bell-sequence',limit:5,baseline:'4',maxDuration:'20',goals:['G1','G2'],bellPitches:[88,84],nodes:two(),
  candidates:[e('S','A',.5),e('A','B',.5),e('A','C',1),e('A','D',1.5),e('B','G1',.5),e('C','G2',1),e('D','G1',1),e('D','G2',2),e('B','G2',3),e('C','G1',2.5)]},
 {id:'Q24',version:1,name:'半秒あとに応えて',type:'bell-sequence',limit:6,baseline:'4',maxDuration:'20',goals:['G1','G2'],intervals:['0.5'],intervalTolerance:'0.1',bellPitches:[88,84],nodes:two(),
  candidates:[e('S','A',.5),e('A','B',.5),e('A','C',1),e('B','D',.5),e('C','D',1),e('D','G1',.5),e('D','G2',1),e('B','G1',2),e('C','G2',2),e('B','G2',2.5),e('C','G1',1.5)]},
 {id:'Q25',version:1,name:'三つの鐘を順番に',type:'bell-sequence',limit:8,baseline:'5',maxDuration:'25',goals:['G1','G2','G3'],bellPitches:[72,79,84],nodes:three(),candidates:routes()},
 {id:'Q26',version:1,name:'のぼる星の三音',type:'bell-sequence',limit:8,baseline:'5',maxDuration:'25',goals:['G1','G2','G3'],intervals:['1','1'],intervalTolerance:'0.1',bellPitches:[72,79,84],nodes:relayNodes(),candidates:relayRoutes()},
 {id:'Q27',version:1,name:'ひとつの分岐、三つの余韻',type:'bell-sequence',limit:8,baseline:'6',maxDuration:'30',goals:['G1','G2','G3'],intervals:['0.5','1'],intervalTolerance:'0.1',bellPitches:[72,77,81],
  nodes:relayNodes().map(node=>node.id==='D'?{...node,process:'1'}:node),candidates:relayRoutes().map(edge=>edge.id==='EG2'?{...edge,time:'1.5'}:edge.id==='DG2'?{...edge,time:'0.5'}:edge.id==='AG1'?{...edge,time:'5'}:edge)},
 {id:'Q28',version:1,name:'降りそそぐ星の余韻',type:'bell-sequence',limit:8,baseline:'6',maxDuration:'30',goals:['G3','G2','G1'],intervals:['0.5','1'],intervalTolerance:'0.1',bellPitches:[84,79,72],nodes:relayNodes(),candidates:relayRoutes().map(edge=>edge.id==='DG1'?{...edge,time:'2'}:edge.id==='EG3'?{...edge,time:'0.5'}:edge)},
];
