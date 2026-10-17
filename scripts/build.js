import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, posix, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const packageVersion=JSON.parse(readFileSync('package.json','utf8')).version;
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
const version=arg('--fixture-version')??packageVersion;
const output=resolve(arg('--output')??'dist'),workspace=resolve('.');
if(output!==join(workspace,'dist')&&!output.startsWith(join(workspace,'設計検証','PWA')+sep))throw new Error('配信資材の出力先はこの作業場所のdistまたはPWA検証用の配下です。');
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('版番号が不正です。');
// Resolve and verify the exact target before replacing generated output.
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
const prefix=`v${version}`, assets=[];
function copyTree(directory) {
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const source=posix.join(directory,entry.name);
    if(entry.isDirectory()&&source!=='src/pwa')copyTree(source);
    else if(entry.isFile()&&/\.(js|css|ttf|txt|svg|png|webp)$/.test(entry.name)) {
      const target=posix.join(prefix,source);mkdirSync(join(output,posix.dirname(target)),{recursive:true});copyFileSync(source,join(output,target));assets.push(`./${target}`);
    }
  }
}
copyTree('src');copyTree('画面案/ロゴ/fonts');copyTree('public');
let index=readFileSync('index.html','utf8');
if(!index.replace(/<[^>]*>/g,'').includes(`検証 v${packageVersion}`))throw new Error('画面の版番号をpackage.jsonと一致させてください。');
index=index.replaceAll(packageVersion,version).replaceAll('./src/',`./${prefix}/src/`).replaceAll('./public/',`./${prefix}/public/`).replace('<!-- OFFLINE_METADATA -->',`<meta name="prism-offline" content="enabled"><link rel="manifest" href="./manifest.webmanifest?v=${version}"><link rel="icon" href="./${prefix}/public/icon-192.png"><link rel="apple-touch-icon" href="./${prefix}/public/apple-touch-icon.png">`);
// Queries on versioned entry points are unnecessary and would split offline keys.
index=index.replaceAll(`?v=${version}`,'');
writeFileSync(join(output,'index.html'),index);
const manifest={id:'./',name:'プリズム・ノーツ',short_name:'PRISM NOTES',lang:'ja',start_url:'./',scope:'./',display:'standalone',background_color:'#060b14',theme_color:'#090d1a',icons:[192,512].map(size=>({src:`./${prefix}/public/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any maskable'}))};
writeFileSync(join(output,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
const all=['./index.html','./manifest.webmanifest',...assets,'./build-info.json'];
const hashes=Object.fromEntries(all.filter(asset=>asset!=='./build-info.json').map(asset=>[asset,createHash('sha256').update(readFileSync(join(output,asset))).digest('hex')]));
writeFileSync(join(output,'build-info.json'),JSON.stringify({version,commit:process.env.GITHUB_SHA??process.env.CF_PAGES_COMMIT_SHA??null,assets:all,hashes},null,2));
const worker=readFileSync('src/pwa/worker.js','utf8').replace('__PRISM_VERSION__',version).replace('__PRISM_ASSETS__',JSON.stringify(all));
writeFileSync(join(output,'sw.js'),worker);writeFileSync(join(output,'.nojekyll'),'');
// Pages metadata is revalidated; only versioned files may be immutable.
writeFileSync(join(output,'_headers'),`/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n/sw.js\n  Cache-Control: no-store, must-revalidate\n/build-info.json\n  Cache-Control: no-store\n/manifest.webmanifest\n  Cache-Control: no-cache\n/v*\n  Cache-Control: public, max-age=31536000, immutable\n`);
console.log(`Built v${version}: ${all.length} offline assets. Versioned modules, fonts, manifest, and worker are ready.`);
