import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function sources(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? sources(join(directory,entry.name)) : entry.name.endsWith('.js') ? [join(directory,entry.name)] : []);
}
const files = ['src','tests','scripts'].flatMap(sources);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check',file], {stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Syntax checks passed: ${files.length} files`);
