// Bound the actual transport, including response bodies. A UI-only Promise.race
// leaves Auth running and can commit a session after the screen reports failure.
export function boundedFetch(fetcher, timeoutMs=12000){
  return async(input,init={})=>{
    const controller=new AbortController(),parent=init.signal||input?.signal;
    const abort=()=>controller.abort(parent?.reason);
    if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>controller.abort(new DOMException('Request timed out','TimeoutError')),timeoutMs);
    try{
      const response=await fetcher(input,{...init,signal:controller.signal});
      const body=await response.arrayBuffer();
      return new Response([204,205,304].includes(response.status)?null:body,{status:response.status,statusText:response.statusText,headers:response.headers});
    }finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
  };
}
