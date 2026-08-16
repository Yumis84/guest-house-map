// Temporary browser-side diagnostics for the guest-house n8n Chat Trigger.
// Activates only when the page URL contains ?debug=1.
(function(){
  if (!new URLSearchParams(location.search).has('debug')) return;
  if (window.__guestChatDebugV1) return;
  window.__guestChatDebugV1 = true;

  const CHAT_WEBHOOK = 'https://n8n.xn----8sbalgvaeklgsbf4b.xn--p1ai/webhook/e32deeb2-aebf-49f2-aabd-aa245542f2cd/chat';

  function esc(value){
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  function mount(){
    if (document.getElementById('guest-chat-debug')) return;

    const style=document.createElement('style');
    style.textContent=`
      #guest-chat-debug{position:fixed;z-index:5000;left:10px;right:10px;top:10px;max-height:48vh;overflow:auto;background:#09100df5;color:#f4f7f5;border:1px solid #f2a93b;border-radius:16px;padding:12px;box-shadow:0 18px 55px #000b;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
      #guest-chat-debug .dbg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
      #guest-chat-debug strong{color:#ffd37f}
      #guest-chat-debug button{border:0;border-radius:10px;padding:9px 11px;background:#f2a93b;color:#271908;font-weight:800}
      #guest-chat-debug button.secondary{background:#202c27;color:#f4f7f5}
      #guest-chat-debug pre{white-space:pre-wrap;word-break:break-word;margin:8px 0 0;background:#0d1311;border-radius:10px;padding:9px;border:1px solid #28362f}
      #guest-chat-debug .row{display:flex;gap:7px;flex-wrap:wrap}
    `;
    document.head.appendChild(style);

    const panel=document.createElement('div');
    panel.id='guest-chat-debug';
    panel.innerHTML=`
      <div class="dbg-head"><strong>n8n Web Chat diagnostics</strong><button class="secondary" id="dbg-close">×</button></div>
      <div>Origin: ${esc(location.origin)}</div>
      <div>Endpoint: ${esc(CHAT_WEBHOOK)}</div>
      <div class="row" style="margin-top:9px"><button id="dbg-send">Отправить production POST</button><button class="secondary" id="dbg-copy">Копировать результат</button></div>
      <pre id="dbg-output">Нажмите «Отправить production POST». Никаких изменений в n8n этот тест не делает: он отправляет обычное сообщение в существующий Chat Trigger.</pre>`;
    document.body.appendChild(panel);

    const out=panel.querySelector('#dbg-output');
    panel.querySelector('#dbg-close').onclick=()=>panel.remove();
    panel.querySelector('#dbg-copy').onclick=async()=>{
      try{await navigator.clipboard.writeText(out.textContent); panel.querySelector('#dbg-copy').textContent='Скопировано';}
      catch(_){panel.querySelector('#dbg-copy').textContent='Не удалось';}
    };

    panel.querySelector('#dbg-send').onclick=async()=>{
      const button=panel.querySelector('#dbg-send');
      button.disabled=true;
      button.textContent='Отправляем…';
      const stamp=Date.now();
      const tag=`DIAG-${stamp}`;
      const payload={
        action:'sendMessage',
        chatInput:`${tag} Привет`,
        sessionId:`guest-house-debug-${stamp}`,
        metadata:{source:'guest-house-map-debug',origin:location.origin}
      };
      const started=performance.now();
      out.textContent=`REQUEST\nPOST ${CHAT_WEBHOOK}\nOrigin: ${location.origin}\nBody: ${JSON.stringify(payload,null,2)}\n\nWAITING…`;
      try{
        const response=await fetch(CHAT_WEBHOOK,{
          method:'POST',
          mode:'cors',
          credentials:'omit',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        const elapsed=Math.round(performance.now()-started);
        const body=await response.text();
        const visibleHeaders={};
        for(const [k,v] of response.headers.entries()) visibleHeaders[k]=v;
        out.textContent=[
          'REQUEST',
          `POST ${CHAT_WEBHOOK}`,
          `Diagnostic tag: ${tag}`,
          `Body: ${JSON.stringify(payload)}`,
          '',
          'RESPONSE',
          `HTTP: ${response.status} ${response.statusText}`,
          `Elapsed: ${elapsed} ms`,
          `Type: ${response.type}`,
          `URL: ${response.url}`,
          `Headers visible to browser: ${JSON.stringify(visibleHeaders,null,2)}`,
          `Body: ${body || '<EMPTY BODY>'}`
        ].join('\n');
      }catch(error){
        const elapsed=Math.round(performance.now()-started);
        out.textContent=[
          'REQUEST',
          `POST ${CHAT_WEBHOOK}`,
          `Diagnostic tag: ${tag}`,
          `Body: ${JSON.stringify(payload)}`,
          '',
          'FETCH ERROR',
          `Elapsed: ${elapsed} ms`,
          `Name: ${error && error.name}`,
          `Message: ${error && error.message}`,
          '',
          'Это обычно означает DNS/TLS/CORS/preflight/network ошибку до получения читаемого HTTP-ответа браузером.'
        ].join('\n');
      }finally{
        button.disabled=false;
        button.textContent='Отправить production POST';
      }
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
