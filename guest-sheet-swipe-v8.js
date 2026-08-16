// Guest house detail sheet: reliable swipe-down close from the large photo area. v8
(function(){
  if(window.__guestSheetSwipeV8)return;
  window.__guestSheetSwipeV8=true;

  const style=document.createElement('style');
  style.id='guest-sheet-swipe-v8-style';
  style.textContent=`
    #detail .sheet.guest-photo-dragging{transition:none!important;will-change:transform,opacity}
    #detail .sheet.guest-photo-snapping{transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s ease!important}
    #detail .hero.gh-photo-hero{touch-action:pan-x!important}
    #detail .gh-gallery{touch-action:pan-x!important}
  `;
  document.head.appendChild(style);

  const overlay=()=>document.getElementById('detail');
  const sheet=()=>document.getElementById('sheet');

  let tracking=false;
  let vertical=false;
  let cancelled=false;
  let startX=0,startY=0,lastY=0,startAt=0;

  function closeSheet(){
    const d=overlay(),s=sheet();
    if(!d||!s)return;
    s.classList.remove('guest-photo-dragging');
    s.classList.add('guest-photo-snapping');
    s.style.transform='translateY(110vh)';
    s.style.opacity='.72';
    setTimeout(()=>{
      d.classList.remove('on');
      s.classList.remove('guest-photo-snapping');
      s.style.transform='';
      s.style.opacity='';
      s.scrollTop=0;
    },220);
  }

  function snapBack(){
    const s=sheet();if(!s)return;
    s.classList.remove('guest-photo-dragging');
    s.classList.add('guest-photo-snapping');
    s.style.transform='translateY(0)';
    s.style.opacity='1';
    setTimeout(()=>s.classList.remove('guest-photo-snapping'),230);
  }

  function isEligibleTarget(target){
    const hero=target.closest?.('#detail .hero.gh-photo-hero');
    if(!hero)return false;
    if(target.closest?.('button,a,input,textarea,select,label'))return false;
    return true;
  }

  function onStart(e){
    const d=overlay(),s=sheet();
    if(!d?.classList.contains('on')||!s||e.touches?.length!==1)return;
    if(!isEligibleTarget(e.target))return;
    if(s.scrollTop>2)return;

    const t=e.touches[0];
    tracking=true;vertical=false;cancelled=false;
    startX=t.clientX;startY=lastY=t.clientY;startAt=performance.now();
  }

  function onMove(e){
    if(!tracking||cancelled||e.touches?.length!==1)return;
    const s=sheet();if(!s)return;
    const t=e.touches[0];
    const dx=t.clientX-startX;
    const dy=t.clientY-startY;
    lastY=t.clientY;

    if(!vertical){
      if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
      if(Math.abs(dx)>Math.abs(dy)*1.05){
        cancelled=true;tracking=false;
        return;
      }
      if(dy<=0){
        cancelled=true;tracking=false;
        return;
      }
      vertical=true;
      s.classList.remove('guest-photo-snapping');
      s.classList.add('guest-photo-dragging');
    }

    if(dy>0){
      e.preventDefault();
      const shown=Math.min(dy,window.innerHeight*.9);
      s.style.transform=`translateY(${shown}px)`;
      s.style.opacity=String(Math.max(.72,1-shown/window.innerHeight*.28));
    }
  }

  function onEnd(){
    if(!tracking&&!vertical)return;
    const dy=Math.max(0,lastY-startY);
    const elapsed=Math.max(1,performance.now()-startAt);
    const velocity=dy/elapsed;
    const wasVertical=vertical;
    tracking=false;vertical=false;

    if(cancelled||!wasVertical){cancelled=false;return;}
    cancelled=false;
    if(dy>=82||velocity>=.42)closeSheet();
    else snapBack();
  }

  function bind(){
    const s=sheet();if(!s||s.dataset.guestPhotoSwipeV8)return;
    s.dataset.guestPhotoSwipeV8='1';
    s.addEventListener('touchstart',onStart,{passive:true,capture:true});
    s.addEventListener('touchmove',onMove,{passive:false,capture:true});
    s.addEventListener('touchend',onEnd,{passive:true,capture:true});
    s.addEventListener('touchcancel',onEnd,{passive:true,capture:true});
  }

  function boot(){
    bind();
    const s=sheet();
    if(s)new MutationObserver(bind).observe(s,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
