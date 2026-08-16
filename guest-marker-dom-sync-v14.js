// Hard-sync the centered bottom card with the actual Leaflet marker DOM. v14
(function(){
  if(window.__guestMarkerDomSyncV14)return;
  window.__guestMarkerDomSyncV14=true;

  let selectedId='';
  let raf=0;
  let paintRaf=0;
  let poll=null;

  const cards=()=>document.getElementById('cards');

  function markerStore(){
    try{return (typeof markers!=='undefined'&&markers)?markers:null}catch(_){return null}
  }

  function centeredCard(){
    const c=cards();
    if(!c||c.style.display==='none')return null;
    const list=[...c.querySelectorAll('.card[data-id]')];
    if(!list.length)return null;
    const r=c.getBoundingClientRect();
    const cx=r.left+r.width/2;
    let best=null,bestDist=Infinity;
    for(const card of list){
      const cr=card.getBoundingClientRect();
      if(cr.right<r.left||cr.left>r.right)continue;
      const d=Math.abs((cr.left+cr.width/2)-cx);
      if(d<bestDist){bestDist=d;best=card}
    }
    return best||list[0];
  }

  function paintNow(){
    paintRaf=0;
    const ms=markerStore();
    if(!ms||!selectedId)return false;
    let count=0;
    for(const [id,m] of Object.entries(ms)){
      if(!m)continue;
      const active=String(id)===String(selectedId);
      let host=null;
      try{host=typeof m.getElement==='function'?m.getElement():m._icon}catch(_){host=null}
      if(!host)continue;
      count++;
      host.dataset.guestHouseId=String(id);
      host.dataset.guestSelected=active?'1':'0';
      host.style.setProperty('z-index',active?'10000':'','important');
      try{if(typeof m.setZIndexOffset==='function')m.setZIndexOffset(active?10000:0)}catch(_){ }

      const core=host.firstElementChild||host.querySelector('div');
      if(core){
        core.style.setProperty('background',active?'#f2a93b':'#111815','important');
        core.style.setProperty('background-color',active?'#f2a93b':'#111815','important');
        core.style.setProperty('color',active?'#241707':'#f2a93b','important');
        core.style.setProperty('border-color','#f2a93b','important');
        core.style.setProperty('transform',active?'scale(1.12)':'scale(1)','important');
        core.style.setProperty('box-shadow',active?'0 8px 26px #0009, 0 0 0 4px #f2a93b55':'0 5px 16px #0006','important');
      }
    }
    return count>0;
  }

  function paint(){
    if(paintRaf)return;
    paintRaf=requestAnimationFrame(paintNow);
  }

  function select(id){
    if(!id)return;
    selectedId=String(id);
    paint();
    // Repaint after Leaflet/legacy setIcon handlers have had a chance to replace DOM nodes.
    setTimeout(paint,0);
    setTimeout(paint,40);
    setTimeout(paint,120);
  }

  function selectCentered(){
    const card=centeredCard();
    if(card)select(card.dataset.id);
  }

  function bindCards(){
    const c=cards();
    if(!c||c.dataset.markerDomSyncV14)return false;
    c.dataset.markerDomSyncV14='1';
    const schedule=()=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;selectCentered()});
    };
    c.addEventListener('scroll',schedule,{passive:true});
    c.addEventListener('touchmove',schedule,{passive:true});
    c.addEventListener('touchend',()=>setTimeout(selectCentered,20),{passive:true});
    c.addEventListener('pointerup',()=>setTimeout(selectCentered,20),{passive:true});
    new MutationObserver(()=>requestAnimationFrame(selectCentered)).observe(c,{childList:true});
    requestAnimationFrame(selectCentered);
    return true;
  }

  function observeLeafletPane(){
    const pane=document.querySelector('.leaflet-marker-pane');
    if(!pane||pane.dataset.guestMarkerDomObserver)return false;
    pane.dataset.guestMarkerDomObserver='1';
    new MutationObserver(()=>{
      // setIcon() replaces the marker element; immediately restore the selected styling.
      paint();
    }).observe(pane,{childList:true,subtree:true});
    return true;
  }

  function bindClicks(){
    document.addEventListener('click',e=>{
      const el=e.target.closest?.('#cards .card[data-id], #list [data-id], #favList [data-id]');
      if(el?.dataset?.id)select(el.dataset.id);
    },true);
  }

  function boot(){
    bindCards();
    bindClicks();
    selectCentered();
    let attempts=0;
    poll=setInterval(()=>{
      attempts++;
      bindCards();
      observeLeafletPane();
      selectCentered();
      paint();
      if(attempts>180){clearInterval(poll);poll=null}
    },100);
    window.addEventListener('pageshow',()=>{selectCentered();paint()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
