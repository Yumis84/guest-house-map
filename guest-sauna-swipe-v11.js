// Guest-house detail gestures ported from the working sauna UX. v11
(function(){
  if(window.__guestSaunaSwipeV11)return;
  window.__guestSaunaSwipeV11=true;

  const style=document.createElement('style');
  style.id='guest-sauna-swipe-v11-style';
  style.textContent=`
    /* Sauna-style card motion. */
    #detail .sheet.guest-sauna-drag{transition:none!important;will-change:transform,opacity}
    #detail .sheet.guest-sauna-anim{transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .2s ease!important;will-change:transform,opacity}

    /* The user asked to remove gallery arrows; photos remain swipeable. */
    #detail .gh-gallery-nav{display:none!important}

    /* Keep the small pull indicator, but the whole card can now be dragged down. */
    #detail .guest-sheet-drag-zone{pointer-events:none!important}
  `;
  document.head.appendChild(style);

  const overlay=()=>document.getElementById('detail');
  const sheet=()=>document.getElementById('sheet');

  let tracking=false;
  let axis=null;
  let source='detail';
  let sx=0,sy=0,lx=0,ly=0,startedAt=0;

  function currentHouse(){
    try{if(typeof chosen!=='undefined'&&chosen&&chosen.id)return chosen}catch(_){ }
    const name=sheet()?.querySelector('.detail h2')?.textContent?.trim();
    try{return (window.GUEST_HOUSES||[]).find(h=>h.name===name)||null}catch(_){return null}
  }

  function currentList(){
    try{
      const fav=document.getElementById('favorites');
      if(fav?.classList.contains('on')){
        const ids=[...document.querySelectorAll('#favList [data-id]')].map(el=>el.dataset.id);
        return ids.map(id=>(window.GUEST_HOUSES||[]).find(h=>h.id===id)).filter(Boolean);
      }
      if(typeof filtered==='function')return filtered();
      return (window.GUEST_HOUSES||[]).filter(h=>h.active!==false);
    }catch(_){return []}
  }

  function neighbor(direction){
    const cur=currentHouse(),list=currentList();
    if(!cur||!list.length)return null;
    const i=list.findIndex(h=>h.id===cur.id);
    if(i<0)return null;
    return list[i+direction]||null;
  }

  function interactive(target){
    return !!target?.closest?.('button,a,input,select,textarea,label');
  }

  function inGallery(target){
    return !!target?.closest?.('.gh-gallery,.gh-gallery-track,.gh-gallery-slide');
  }

  function cleanMotion(){
    const s=sheet();if(!s)return;
    s.classList.remove('guest-sauna-drag','guest-sauna-anim');
  }

  function snapBack(){
    const s=sheet();if(!s)return;
    s.classList.remove('guest-sauna-drag');
    s.classList.add('guest-sauna-anim');
    s.style.transform='translate3d(0,0,0)';
    s.style.opacity='1';
    setTimeout(()=>s.classList.remove('guest-sauna-anim'),220);
  }

  function closeCard(){
    const d=overlay(),s=sheet();if(!d||!s)return;
    s.classList.remove('guest-sauna-drag');
    s.classList.add('guest-sauna-anim');
    s.style.transform='translate3d(0,110vh,0)';
    s.style.opacity='.72';
    setTimeout(()=>{
      d.classList.remove('on');
      cleanMotion();
      s.style.transform='';
      s.style.opacity='';
      s.scrollTop=0;
    },210);
  }

  function alignUnderlying(id){
    requestAnimationFrame(()=>{
      const favorites=document.getElementById('favorites');
      if(favorites?.classList.contains('on')){
        favorites.querySelector(`[data-id="${id}"]`)?.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
        return;
      }
      const catalog=document.getElementById('catalog');
      if(catalog?.classList.contains('on')){
        catalog.querySelector(`[data-id="${id}"]`)?.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
        return;
      }
      const cards=document.getElementById('cards');
      const card=cards?.querySelector(`.card[data-id="${id}"]`);
      if(card){
        const left=card.offsetLeft-(cards.clientWidth-card.clientWidth)/2;
        cards.scrollTo({left:Math.max(0,left),behavior:'smooth'});
      }
    });
  }

  function switchHouse(target,direction){
    const s=sheet();if(!s||!target)return snapBack();
    const exitX=direction>0?-window.innerWidth:window.innerWidth;
    s.classList.remove('guest-sauna-drag');
    s.classList.add('guest-sauna-anim');
    s.style.transform=`translate3d(${exitX}px,0,0)`;
    s.style.opacity='.45';

    setTimeout(()=>{
      try{
        if(typeof window.openHouse!=='function')throw new Error('openHouse unavailable');
        window.openHouse(target.id);
        s.scrollTop=0;
        alignUnderlying(target.id);

        s.classList.remove('guest-sauna-anim');
        s.style.transform=`translate3d(${-exitX*.24}px,0,0)`;
        s.style.opacity='.72';
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          s.classList.add('guest-sauna-anim');
          s.style.transform='translate3d(0,0,0)';
          s.style.opacity='1';
          setTimeout(()=>s.classList.remove('guest-sauna-anim'),220);
        }));
      }catch(_){snapBack()}
    },165);
  }

  function start(e){
    const d=overlay(),s=sheet();
    if(!d?.classList.contains('on')||!s||e.touches?.length!==1)return;
    if(interactive(e.target))return;

    const t=e.touches[0];
    tracking=true;axis=null;
    source=inGallery(e.target)?'gallery':'detail';
    sx=lx=t.clientX;sy=ly=t.clientY;startedAt=performance.now();
  }

  function move(e){
    if(!tracking||e.touches?.length!==1)return;
    const s=sheet();if(!s)return;
    const t=e.touches[0];lx=t.clientX;ly=t.clientY;
    const dx=lx-sx,dy=ly-sy;

    if(!axis){
      if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
      axis=Math.abs(dx)>Math.abs(dy)*1.05?'x':'y';

      // On the gallery, horizontal swipe belongs to the photo gallery itself.
      if(axis==='x'&&source==='gallery'){
        tracking=false;axis=null;
        return;
      }

      // Vertical upward movement or an already scrolled sheet belongs to native scrolling.
      if(axis==='y'&&(dy<0||s.scrollTop>2)){
        tracking=false;axis=null;
        return;
      }

      s.classList.remove('guest-sauna-anim');
      s.classList.add('guest-sauna-drag');
    }

    if(axis==='y'){
      const down=Math.max(0,dy);
      const shown=Math.min(down,window.innerHeight*.9);
      s.style.transform=`translate3d(0,${shown}px,0)`;
      s.style.opacity=String(Math.max(.72,1-shown/window.innerHeight*.28));
      if(e.cancelable)e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if(axis==='x'&&source==='detail'){
      const direction=dx<0?1:-1;
      const hasTarget=!!neighbor(direction);
      const shown=hasTarget?dx:dx*.26;
      const cap=Math.min(window.innerWidth*.72,Math.abs(shown));
      const tx=Math.sign(shown)*cap;
      s.style.transform=`translate3d(${tx}px,0,0)`;
      s.style.opacity=String(Math.max(.72,1-Math.abs(tx)/window.innerWidth*.32));
      if(e.cancelable)e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  function end(e){
    if(!tracking)return;
    const dx=lx-sx,dy=ly-sy;
    const elapsed=Math.max(1,performance.now()-startedAt);
    const vx=Math.abs(dx)/elapsed,vy=Math.abs(dy)/elapsed;
    const finalAxis=axis,finalSource=source;
    tracking=false;axis=null;

    if(finalAxis==='y'){
      if(dy>0&&(dy>=82||vy>=.42))closeCard();
      else snapBack();
      e.stopImmediatePropagation();
      return;
    }

    if(finalAxis==='x'&&finalSource==='detail'){
      const direction=dx<0?1:-1;
      const target=neighbor(direction);
      const threshold=Math.min(105,window.innerWidth*.24);
      if(target&&(Math.abs(dx)>=threshold||vx>=.48))switchHouse(target,direction);
      else snapBack();
      e.stopImmediatePropagation();
    }
  }

  function bind(){
    const s=sheet();if(!s||s.dataset.guestSaunaSwipeV11)return;
    s.dataset.guestSaunaSwipeV11='1';

    // Capture phase gives this controller priority over legacy v5/v10 listeners.
    s.addEventListener('touchstart',start,{capture:true,passive:true});
    s.addEventListener('touchmove',move,{capture:true,passive:false});
    s.addEventListener('touchend',end,{capture:true,passive:true});
    s.addEventListener('touchcancel',end,{capture:true,passive:true});

    overlay()?.addEventListener('click',e=>{if(e.target===overlay())closeCard()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay()?.classList.contains('on'))closeCard()});
  }

  function boot(){
    bind();
    const s=sheet();
    if(s)new MutationObserver(()=>requestAnimationFrame(bind)).observe(s,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
