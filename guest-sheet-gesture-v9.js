// Unified gesture controller for the guest-house detail hero. Android/iOS friendly. v9
(function(){
  if(window.__guestSheetGestureV9)return;
  window.__guestSheetGestureV9=true;

  const style=document.createElement('style');
  style.id='guest-sheet-gesture-v9-style';
  style.textContent=`
    #detail .hero.gh-photo-hero,
    #detail .gh-gallery,
    #detail .gh-gallery-track,
    #detail .gh-gallery-slide,
    #detail .gh-gallery-slide img{
      touch-action:none!important;
      -webkit-user-select:none!important;
      user-select:none!important;
      -webkit-user-drag:none!important;
    }
    #detail .sheet.guest-v9-dragging{transition:none!important;will-change:transform,opacity}
    #detail .sheet.guest-v9-snapping{transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .2s ease!important}
  `;
  document.head.appendChild(style);

  const overlay=()=>document.getElementById('detail');
  const sheet=()=>document.getElementById('sheet');

  let active=false;
  let pointerId=null;
  let axis=null;
  let sx=0,sy=0,lx=0,ly=0,startedAt=0;

  function interactive(target){
    return !!target?.closest?.('button,a,input,textarea,select,label');
  }

  function eligible(target){
    if(!target?.closest)return false;
    return !!target.closest('#detail .hero.gh-photo-hero, #detail .guest-sheet-drag-zone');
  }

  function cleanupClasses(){
    const s=sheet();if(!s)return;
    s.classList.remove('guest-v9-dragging');
  }

  function snapBack(){
    const s=sheet();if(!s)return;
    cleanupClasses();
    s.classList.add('guest-v9-snapping');
    s.style.transform='translateY(0)';
    s.style.opacity='1';
    setTimeout(()=>s.classList.remove('guest-v9-snapping'),220);
  }

  function closeSheet(){
    const d=overlay(),s=sheet();
    if(!d||!s)return;
    cleanupClasses();
    s.classList.add('guest-v9-snapping');
    s.style.transform='translateY(105vh)';
    s.style.opacity='.68';
    setTimeout(()=>{
      d.classList.remove('on');
      s.classList.remove('guest-v9-snapping');
      s.style.transform='';
      s.style.opacity='';
      s.scrollTop=0;
    },205);
  }

  function stepGallery(direction){
    const hero=document.querySelector('#detail .hero.gh-photo-hero');
    if(!hero)return;
    const btn=hero.querySelector(direction>0?'.gh-gallery-next':'.gh-gallery-prev');
    if(btn&&!btn.disabled)btn.click();
  }

  function resetState(){
    active=false;pointerId=null;axis=null;
  }

  function onPointerDown(e){
    if(e.pointerType==='mouse')return;
    const d=overlay(),s=sheet();
    if(!d?.classList.contains('on')||!s)return;
    if(!eligible(e.target)||interactive(e.target))return;
    if(s.scrollTop>2)return;

    active=true;pointerId=e.pointerId;axis=null;
    sx=lx=e.clientX;sy=ly=e.clientY;startedAt=performance.now();
    s.classList.remove('guest-v9-snapping');
    try{e.target.setPointerCapture?.(e.pointerId)}catch(_){ }
    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e){
    if(!active||e.pointerId!==pointerId)return;
    const s=sheet();if(!s)return;
    lx=e.clientX;ly=e.clientY;
    const dx=lx-sx,dy=ly-sy;

    if(!axis){
      if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
      axis=Math.abs(dx)>Math.abs(dy)*1.08?'x':'y';
      if(axis==='y')s.classList.add('guest-v9-dragging');
    }

    if(axis==='y'){
      const down=Math.max(0,dy);
      const up=Math.max(0,-dy);
      const shown=down>0?Math.min(down,window.innerHeight*.9):-Math.min(up*.08,18);
      s.style.transform=`translateY(${shown}px)`;
      s.style.opacity=String(down>0?Math.max(.68,1-down/window.innerHeight*.32):1);
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function finish(e){
    if(!active||e.pointerId!==pointerId)return;
    const dx=lx-sx,dy=ly-sy;
    const elapsed=Math.max(1,performance.now()-startedAt);
    const vx=Math.abs(dx)/elapsed,vy=Math.abs(dy)/elapsed;
    const finalAxis=axis;
    resetState();

    if(finalAxis==='y'){
      if(dy>0&&(dy>=68||vy>=.36))closeSheet();
      else snapBack();
    }else if(finalAxis==='x'){
      if(Math.abs(dx)>=42||vx>=.34)stepGallery(dx<0?1:-1);
    }else{
      snapBack();
    }

    e.preventDefault();
    e.stopPropagation();
  }

  // Pointer Events are the source of truth for gestures.
  document.addEventListener('pointerdown',onPointerDown,{capture:true,passive:false});
  document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',finish,{capture:true,passive:false});
  document.addEventListener('pointercancel',finish,{capture:true,passive:false});

  // Suppress the older touch handlers inside the photo gallery so one gesture
  // cannot be processed twice (the v9 pointer controller handles it instead).
  ['touchstart','touchmove','touchend','touchcancel'].forEach(type=>{
    document.addEventListener(type,e=>{
      if(!e.target?.closest?.('#detail .hero.gh-photo-hero'))return;
      if(interactive(e.target))return;
      if(type==='touchmove'&&e.cancelable)e.preventDefault();
      e.stopImmediatePropagation();
    },{capture:true,passive:type!=='touchmove'});
  });
})();
