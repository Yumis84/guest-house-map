// Reliable active marker sync for guest-house map. Fixes late Leaflet bootstrap and overlapping pins. v13
(function(){
  if(window.__guestActiveMarkerV13)return;
  window.__guestActiveMarkerV13=true;

  let selectedId=null;
  let raf=0;
  let pollTimer=null;

  function getMarkers(){
    try{return (typeof markers!=='undefined'&&markers)?markers:null}catch(_){return null}
  }

  function markerIcon(id,active){
    return L.divIcon({
      className:'',
      html:`<div data-guest-marker="${String(id)}" style="width:40px;height:40px;border-radius:14px;background:${active?'#f2a93b':'#111815'};border:2px solid #f2a93b;display:grid;place-items:center;color:${active?'#241707':'#f2a93b'};font-size:21px;box-shadow:${active?'0 8px 24px #0009,0 0 0 4px #f2a93b3d':'0 5px 16px #0006'};transform:${active?'scale(1.08)':'scale(1)'};transition:background .16s ease,color .16s ease,transform .16s ease,box-shadow .16s ease">⌂</div>`,
      iconSize:[40,40],
      iconAnchor:[20,20]
    });
  }

  function refresh(){
    if(!window.L||!selectedId)return false;
    const ms=getMarkers();
    if(!ms)return false;
    let count=0;
    for(const [id,m] of Object.entries(ms)){
      if(!m)continue;
      count++;
      const active=String(id)===String(selectedId);
      try{
        if(typeof m.setIcon==='function')m.setIcon(markerIcon(id,active));
        if(typeof m.setZIndexOffset==='function')m.setZIndexOffset(active?10000:0);
        const el=typeof m.getElement==='function'?m.getElement():null;
        if(el){
          el.style.zIndex=active?'10000':'';
          el.dataset.guestActive=active?'1':'0';
        }
      }catch(_){ }
    }
    return count>0;
  }

  function setSelected(id){
    if(!id)return;
    selectedId=String(id);
    // Always refresh, even when the id did not change: markers may have been created after selection.
    refresh();
  }

  function centeredCard(){
    const cards=document.getElementById('cards');
    if(!cards||cards.style.display==='none')return null;
    const list=[...cards.querySelectorAll('.card[data-id]')];
    if(!list.length)return null;
    const r=cards.getBoundingClientRect();
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

  function selectCentered(){
    const card=centeredCard();
    if(card)setSelected(card.dataset.id);
  }

  function bindCards(){
    const cards=document.getElementById('cards');
    if(!cards||cards.dataset.activeMarkerV13)return false;
    cards.dataset.activeMarkerV13='1';
    const schedule=()=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;selectCentered()});
    };
    cards.addEventListener('scroll',schedule,{passive:true});
    cards.addEventListener('touchend',()=>setTimeout(selectCentered,20),{passive:true});
    cards.addEventListener('pointerup',()=>setTimeout(selectCentered,20),{passive:true});
    new MutationObserver(()=>requestAnimationFrame(selectCentered)).observe(cards,{childList:true});
    requestAnimationFrame(selectCentered);
    return true;
  }

  function bindClicks(){
    document.addEventListener('click',e=>{
      const card=e.target.closest?.('#cards .card[data-id], #list [data-id], #favList [data-id]');
      if(card?.dataset?.id)setSelected(card.dataset.id);
    },true);
  }

  function pollMarkers(){
    clearInterval(pollTimer);
    let attempts=0;
    pollTimer=setInterval(()=>{
      attempts++;
      bindCards();
      selectCentered();
      const ready=refresh();
      if((ready&&attempts>8)||attempts>120){clearInterval(pollTimer);pollTimer=null}
    },100);
  }

  function boot(){
    bindCards();
    bindClicks();
    selectCentered();
    pollMarkers();
    window.addEventListener('pageshow',()=>{selectCentered();pollMarkers()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
