// Fail closed; never return provider errors or tokens to the public caller.
export async function verifyTurnstile({token,ip,widgetId,secret,hostname,fetcher=fetch}){
 if(!secret||!hostname||typeof token!=='string'||!token||token.length>2048)return false;
 try{
  const result=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:token,remoteip:ip}),signal:AbortSignal.timeout(8000)});
  if(!result.ok)return false;const data=await result.json();
  return data.success===true&&data.hostname===hostname&&data.action==='booking'&&data.cdata===widgetId;
 }catch{return false;}
}
