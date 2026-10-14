// Player names only. Simulation IDs and saved circuit data stay unchanged.
export function partName(node,nodes=[],short=false) {
  if(!node)return '';
  if(node.name)return node.name;
  if(node.kind==='source')return '星';
  if(node.kind==='goal'){
    const goals=nodes.filter(point=>point.kind==='goal'),number=/^G(\d+)$/.exec(node.id)?.[1];
    return `鐘${number??(goals.length>1?goals.findIndex(point=>point.id===node.id)+1:'')}`;
  }
  return short?node.id:`プリズム${node.id}`;
}
export function objectName(id,circuit,candidates=[]) {
  const node=circuit.nodes.find(point=>point.id===id);if(node)return partName(node,circuit.nodes);
  const edge=circuit.edges.find(path=>path.id===id)??candidates.find(path=>path.id===id);
  if(edge)return edge.bidirectional?`${objectName(edge.from,circuit)}と${objectName(edge.to,circuit)}をつなぐ道`:`${objectName(edge.from,circuit)}から${objectName(edge.to,circuit)}への道`;
  return id;
}
