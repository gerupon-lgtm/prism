import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files=readdirSync('tests').filter(name=>name.endsWith('.test.js')).sort().map(name=>`tests/${name}`);
for(let start=0;start<files.length;start+=5) {
  const batch=files.slice(start,start+5);
  console.log(`Test batch ${Math.floor(start/5)+1}: ${batch.join(', ')}`);
  const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...batch],{stdio:'inherit'});
  if(result.status!==0) process.exit(result.status ?? 1);
}
console.log(`All ${files.length} test files passed.`);
