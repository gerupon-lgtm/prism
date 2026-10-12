import { readFileSync } from 'node:fs';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const base=process.env.PRISM_PUBLIC_URL;
if(!base)throw new Error('PRISM_PUBLIC_URLが必要です。');
const response=await fetch(new URL(`build-info.json?release-check=${Date.now()}`,base),{signal:AbortSignal.timeout(15000),cache:'no-store'});
if(response.status===404)console.log(`First public release: v${version}`);
else{
  if(!response.ok)throw new Error(`公開版を確認できません: HTTP ${response.status}`);
  const live=await response.json();
  if(!/^\d+\.\d+\.\d+$/.test(live.version))throw new Error('公開版の版番号を読めません。確認してからデプロイしてください。');
  const current=version.split('.').map(BigInt),published=live.version.split('.').map(BigInt);
  let comparison=0;
  for(let i=0;i<3;i++)if(current[i]!==published[i]){comparison=current[i]>published[i]?1:-1;break;}
  if(comparison<=0)throw new Error(`v${live.version}は公開済みです。公開版より新しい表示版とキャッシュバスターへ更新してからデプロイしてください。`);
  console.log(`Release check: public v${live.version} -> v${version}`);
}
