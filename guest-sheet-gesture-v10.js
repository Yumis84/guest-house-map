// Dedicated gesture layer over the guest-house photo area. v10
(function(){
  if(window.__guestSheetGestureV10)return;
  window.__guestSheetGestureV10=true;

  const style=document.createElement('style');
  style.id='guest-sheet-gesture-v10-style';
  style.textContent=`
    #detail .hero.gh-photo-hero{position:relative!important}
    #detail .guest-gesture-catcher{
      position:absolute;inset:0;z-index:5;
      touch-action:none!important;
      -webkit-user-select:none!important;user-select:none!important;
      background:transparent;
    }
    #detail .hero.gh-photo-hero>.fav,
    #detail .hero.gh-photo-hero>.x,
    #detail .gh-gallery-nav,
    #detail .gh-gallery-meta,
    #detail .gh-gallery-dots{z-index:9!important}
    #detail .sheet.guest-v10-dragging{transition:none!important;will-change:transform,opacity}
    #detail .sheet.guest-v10-snapping{transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .2s ease!important}
  `;
  document.head.appendChild(style);

  const overlay=()=>document.getElementById('detail');
  const sheet=()=>document.getElementById('sheet');

  function stepGallery(direction){
    const hero=document.querySelector('#detail .hero.gh-photo-hero');
    const btn=hero?.querySelector(direction>0?'.gh-gallery-next':'.gh-gallery-prev');
    if(btn&&!btn.disabled)btn.click();
  }

  function snapBack(){
    const s=sheet();if(!s)return;
    s.classList.remove('guest-v10-dragging');
    s.classList.add('guest-v10-snapping');
    s.style.transform='translate3d(0,0,0)';
    s.style.opacity='1';
    setTimeout(()=>s.classList.remove('guest-v10-snapping'),220);
  }

  function closeSheet(){
    const d=overlay(),s=sheet();if(!d||!s)return;
    s.classList.remove('guest-v10-dragging');
    s.classList.add('guest-v10-snapping');
    s.style.transform='translate3d(0,105vh,0)';
    s.style.opacity='.66';
    setTimeout(()=>{
      d.classList.remove('on');
      s.classList.remove('guest-v10-snapping');
      s.style.transform='';
      s.style.opacity='';
      s.scrollTop=0;
    },205);
  }

  function bindCatcher(catcher){
    if(catcher.dataset.boundV10)return;
    catcher.dataset.boundV10='1';

    let active=false,pid=null,axis=null;
    let sx=0,sy=0,lx=0,ly=0,started=0;

    const reset=()=>{active=false;pid=null;axis=null};

    const down=e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      const d=overlay(),s=sheet();
      if(!d?.classList.contains('on')||!s)return;
      active=true;pid=e.pointerId;axis=null;
      sx=lx=e.clientX;sy=ly=e.clientY;started=performance.now();
      s.classList.remove('guest-v10-snapping');
      try{catcher.setPointerCapture(e.pointerId)}catch(_){}
      e.preventDefault();e.stopPropagation();
    };

    const move=e=>{
      if(!active||e.pointerId!==pid)return;
      const s=sheet();if(!s)return;
      lx=e.clientX;ly=e.clientY;
      const dx=lx-sx,dy=ly-sy;
      if(!axis){
        if(Math.abs(dx)<7&&Math.abs(dy)<7)return;
        axis=Math.abs(dx)>Math.abs(dy)*1.05?'x':'y';
        if(axis==='y')s.classList.add('guest-v10-dragging');
      }
      if(axis==='y'){
        const shown=dy>0?Math.min(dy,window.innerHeight*.92):-Math.min(Math.abs(dy)*.06,14);
        s.style.transform=`translate3d(0,${shown}px,0)`;
        s.style.opacity=String(dy>0?Math.max(.66,1-dy/window.innerHeight*.34):1);
      }
      e.preventDefault();e.stopPropagation();
    };

    const finish=e=>{
      if(!active||e.pointerId!==pid)return;
      const dx=lx-sx,dy=ly-sy;
      const elapsed=Math.max(1,performance.now()-started);
      const vx=Math.abs(dx)/elapsed,vy=Math.abs(dy)/elapsed;
      const a=axis;reset();
      if(a==='y'){
        if(dy>0&&(dy>=55||vy>=.28))closeSheet();
        else snapBack();
      }else if(a==='x'){
        if(Math.abs(dx)>=36||vx>=.28)stepGallery(dx<0?1:-1);
      }
      e.preventDefault();e.stopPropagation();
    };

    catcher.addEventListener('pointerdown',down,{passive:false});
    catcher.addEventListener('pointermove',move,{passive:false});
    catcher.addEventListener('pointerup',finish,{passive:false});
    catcher.addEventListener('pointercancel',finish,{passive:false});

    // Fallback for browsers without Pointer Events.
    if(!window.PointerEvent){
      let tx=0,ty=0,tlastX=0,tlastY=0,taxis=null,tstart=0;
      catcher.addEventListener('touchstart',e=>{
        if(e.touches.length!==1)return;
        const t=e.touches[0];tx=tlastX=t.clientX;ty=tlastY=t.clientY;taxis=null;tstart=performance.now();
        e.preventDefault();e.stopPropagation();
      },{passive:false});
      catcher.addEventListener('touchmove',e=>{
        if(e.touches.length!==1)return;
        const t=e.touches[0],dx=t.clientX-tx,dy=t.clientY-ty;tlastX=t.clientX;tlastY=t.clientY;
        if(!taxis&&Math.max(Math.abs(dx),Math.abs(dy))>7)taxis=Math.abs(dx)>Math.abs(dy)*1.05?'x':'y';
        if(taxis==='y'){
          const s=sheet(),shown=dy>0?Math.min(dy,window.innerHeight*.92):-Math.min(Math.abs(dy)*.06,14);
          if(s){s.classList.add('guest-v10-dragging');s.style.transform=`translate3d(0,${shown}px,0)`;}
        }
        e.preventDefault();e.stopPropagation();
      },{passive:false});
      catcher.addEventListener('touchend',e=>{
        const dx=tlastX-tx,dy=tlastY-ty,elapsed=Math.max(1,performance.now()-tstart);
        if(taxis==='y')dy>0&&(dy>=55||Math.abs(dy)/elapsed>=.28)?closeSheet():snapBack();
        else if(taxis==='x'&&Math.abs(dx)>=36)stepGallery(dx<0?1:-1);
        taxis=null;e.preventDefault();e.stopPropagation();
      },{passive:false});
    }
  }

  function ensure(){
    const hero=document.querySelector('#detail .hero.gh-photo-hero');
    if(!hero)return;
    let catcher=hero.querySelector('.guest-gesture-catcher');
    if(!catcher){
      catcher=document.createElement('div');
      catcher.className='guest-gesture-catcher';
      catcher.setAttribute('aria-hidden','true');
      hero.appendChild(catcher);
    }
    bindCatcher(catcher);
  }

  function boot(){
    ensure();
    const s=sheet();
    if(s)new MutationObserver(()=>requestAnimationFrame(ensure)).observe(s,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
