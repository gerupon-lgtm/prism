// Render the adopted wordmark with its bundled licensed fonts; no network fonts.
const fs=require('node:fs'),path=require('node:path');
const at=process.argv.indexOf('--playwright-path');if(at<0)throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(path.resolve(process.argv[at+1])),root=path.resolve(__dirname,'..');
const font=weight=>fs.readFileSync(path.join(root,'画面案/ロゴ/fonts',`montserrat-${weight}.ttf`)).toString('base64');
(async()=>{
  const browser=await pw.chromium.launch({headless:true});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    for(const size of [192,512,180]){
      await page.setViewportSize({width:size,height:size});
      const base=size*.16;
      await page.setContent(`<style>@font-face{font-family:Montserrat;src:url(data:font/ttf;base64,${font(600)});font-weight:600}@font-face{font-family:Montserrat;src:url(data:font/ttf;base64,${font(500)});font-weight:500}body{margin:0;background:#060b14;display:grid;place-items:center;height:100vh}.logo{display:flex;flex-direction:column;align-items:center}.prism{font:600 ${base}px Montserrat;color:#dfb96e;letter-spacing:${base/12}px;margin-right:${-base/12}px}.notes{font:500 ${base*.375}px Montserrat;color:#c6a355;letter-spacing:${base*.2291666667}px;margin-right:${-base*.2291666667}px;margin-top:${base/12}px}</style><div class="logo"><div class="prism">PRISM</div><div class="notes">NOTES</div></div>`);
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:path.join(root,'public',size===180?'apple-touch-icon.png':`icon-${size}.png`)});
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
