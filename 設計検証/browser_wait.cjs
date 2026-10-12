// Await each asynchronous predicate result explicitly. waitForFunction tests
// the returned Promise for truthiness before adopting its resolved value.
async function waitForAsync(page,predicate,arg,{timeout=15000}={}) {
  const deadline=performance.now()+timeout;
  const expired=()=>new Error('Asynchronous browser condition did not become ready');
  while(true){
    const remaining=deadline-performance.now();if(remaining<=0)throw expired();
    let timer,result;
    try{result=await Promise.race([page.evaluate(predicate,arg),new Promise((_,reject)=>{timer=setTimeout(()=>reject(expired()),remaining);})]);}
    finally{clearTimeout(timer);}
    if(performance.now()>=deadline)throw expired();if(result)return result;
    await page.waitForTimeout(Math.min(100,deadline-performance.now()));
  }
}
module.exports={waitForAsync};
