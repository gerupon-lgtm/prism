import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const {version}=JSON.parse(readFileSync('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('版番号が不正です。');
const prefix=`v${version}`, assets=[];
function copyTree(directory) {
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const source=posix.join(directory,entry.name);
    if(entry.isDirectory())copyTree(source);
    else if(/\.(js|css|ttf|txt)$/.test(entry.name)) {
      const target=posix.join(prefix,source);mkdirSync(join('dist',posix.dirname(target)),{recursive:true});copyFileSync(source,join('dist',target));assets.push(`./${target}`);
    }
  }
}
mkdirSync('dist',{recursive:true});copyTree('src');copyTree('画面案/ロゴ/fonts');
let index=readFileSync('index.html','utf8');
if(!index.includes(`検証 v${version}`))throw new Error('画面の版番号をpackage.jsonと一致させてください。');
index=index.replaceAll('./src/',`./${prefix}/src/`).replace('<!-- PWA -->','');
writeFileSync('dist/index.html',index);
writeFileSync('dist/build-info.json',JSON.stringify({version,assets:['./index.html',...assets]},null,2));
console.log(`Built v${version}: ${assets.length} versioned assets. Browser modules and fonts share the same version path.`);
