// Windows WebKit reports this stopped-origin network diagnostic as pageerror.
// Playwright splits at the first colon and removes the first protocol slash.
function expectedStoppedOriginWorkerError(error){
  if(error.engine!=='webkit'||error.originOffline!==true||error.name!=='Cannot load http'||error.stack)return false;
  let page;try{page=new URL(error.url);}catch{return false;}
  if(page.protocol!=='http:'||page.hostname!=='127.0.0.1'||page.pathname!=='/prism/')return false;
  return error.message===`/${page.host}/prism/sw.js due to access control checks.`;
}
module.exports={expectedStoppedOriginWorkerError};
