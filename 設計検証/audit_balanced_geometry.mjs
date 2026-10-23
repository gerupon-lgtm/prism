import {writeFileSync} from 'node:fs';
import {challenges} from '../src/content/challenges.js';
const rows=[];
for(const c of challenges){
 const ns=c.nodes.map(n=>({...n,...c.displayPositions?.[n.id]}));
 const mirror=new Map(ns.map(n=>[n.id,ns.find(m=>m.kind===n.kind&&Math.abs(m.x+n.x-1)<1e-8&&Math.abs(m.y-n.y)<1e-8)?.id]));
 const reflectParts=[...mirror.values()].every(Boolean);
 const reflectSkeleton=c.candidates.every(e=>c.candidates.some(f=>(f.from===mirror.get(e.from)&&f.to===mirror.get(e.to))||(f.to===mirror.get(e.from)&&f.from===mirror.get(e.to))));
 let min=Infinity,worst;
 for(const e of c.candidates){
  const a=ns.find(n=>n.id===e.from),b=ns.find(n=>n.id===e.to),dx=(b.x-a.x)*1650,dy=(b.y-a.y)*1740;
  for(const n of ns.filter(n=>n.id!==a.id&&n.id!==b.id)){
   const px=(n.x-a.x)*1650,py=(n.y-a.y)*1740,t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy))),d=Math.hypot(px-t*dx,py-t*dy)-130;
   if(d<min){min=d;worst=[e.id,n.id];}
  }
 }
 rows.push({stage:c.number,id:c.id,reflectParts,reflectSkeleton,gap:Math.round(min*100)/100,worst});
}
writeFileSync('設計検証/対称配置実装-20261023/geometry.json',JSON.stringify(rows,null,2));
console.log(rows.filter(r=>!r.reflectParts||r.gap<30||(!r.reflectSkeleton&&r.stage>6)));
