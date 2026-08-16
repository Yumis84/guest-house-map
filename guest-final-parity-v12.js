// Final sauna parity for guest houses: favorite hearts + active map marker. v12
(function(){
  if(window.__guestFinalParityV12)return;
  window.__guestFinalParityV12=true;

  const FAV_KEY='rominta_favs';
  let selectedId=null;
  let raf=0;

  const style=document.createElement('style');
  style.id='guest-final-parity-v12-style';
  style.textContent=`
    .heart-svg{display:block;overflow:visible;pointer-events:none}
    .heart-svg path{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:fill .16s ease,stroke .16s ease,transform .16s ease;transform-origin:center}
    .heart-svg.filled path{fill:currentColor}

    #sheet .fav{display:grid!important;place-items:center;color:#ffd37f!important}
    #sheet .fav .heart-svg{width:25px;height:25px}

    #favorites .item{position:relative}
    #favorites .fav-remove{position:absolute;z-index:12;right:10px;top:10px;width:38px;height:38px;border:0;border-radius:50%;background:#09100dcc;color:#ffd37f;display:grid;place-items:center;box-shadow:0 3px 12px #0005}
    #favorites .fav-remove .heart-svg{width:22px;height:22px}
    #favorites .item .ib{padding-right:54px}

    #list .item{position:relative}
    #list .catalog-fav-indicator{position:absolute;z-index:8;right:10px;top:10px;width:36px;height:36px;border-radius:50%;background:#09100dcc;color:#ffd37f;display:grid;place-items:center;pointer-events:none;box-shadow:0 3px 12px #0005}
    #list .catalog-fav-indicator .heart-svg{width:21px;height:21px}
    #list .item .ib{padding-right:50px}

    .nav [data-s="favorites"] span .heart-svg{width:22px;height:22px;margin:0 auto}
  `;
  document.head.appendChild(style);

  const heartSvg=filled=>`<svg class="heart-svg${filled?' filled':''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.2C10.1 18.5 4.2 14.2 4.2 9.5C4.2 7.1 6.1 5.3 8.5 5.3C10 5.3 11.3 6.1 12 7.3C12.7 6.1 14 5.3 15.5 5.3C17.9 5.3 19.8 7.1 19.8 9.5C19.8 14.2 13.9 18.5 12 20.2Z"/></svg>`;

  function favIds(){
    try{return new Set((JSON.parse(localStorage.getItem(FAV_KEY)||'[]')||[]).map(String))}
    catch(_){return new Set()}
  }

  function writeFavs(set){
    const ids=[...set].map(String);
    localStorage.setItem(FAV_KEY,JSON.stringify(ids));
    try{
      if(typeof favs!=='undefined'&&favs&&typeof favs.clear==='function'){
        favs.clear();ids.forEach(id=>favs.add(id));
      }
    }catch(_){ }
  }

  function decorateFavorites(){
    const ids=favIds();
    const list=document.getElementById('favList');
    if(!list)return;

    list.querySelectorAll('.item[data-id]').forEach(item=>{
      const id=String(item.dataset.id||'');
      if(!id)return;
      let btn=item.querySelector('.fav-remove');
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';
        btn.className='fav-remove';
        btn.dataset.removeFav=id;
        btn.setAttribute('aria-label','Удалить из избранного');
        btn.innerHTML=heartSvg(true);
        item.appendChild(btn);
        btn.addEventListener('click',e=>{
          e.preventDefault();e.stopPropagation();
          const set=favIds();set.delete(id);writeFavs(set);
          try{if(typeof renderFavorites==='function')renderFavorites()}catch(_){ }
          requestAnimationFrame(refreshFavoritesUi);
          try{if(typeof toast==='function')toast('Удалено из избранного')}catch(_){ }
        });
      }
      btn.innerHTML=heartSvg(ids.has(id));
    });
  }

  function decorateCatalog(){
    const ids=favIds();
    document.querySelectorAll('#list .item[data-id]').forEach(item=>{
      const id=String(item.dataset.id||'');
      let badge=item.querySelector('.catalog-fav-indicator');
      if(!badge){
        badge=document.createElement('span');
        badge.className='catalog-fav-indicator';
        badge.setAttribute('aria-hidden','true');
        item.appendChild(badge);
      }
      badge.innerHTML=heartSvg(ids.has(id));
      badge.style.display=ids.has(id)?'grid':'none';
    });
  }

  function syncOpenHeart(){
    const btn=document.querySelector('#sheet .fav');
    if(!btn)return;
    let id='';
    try{if(typeof chosen!=='undefined'&&chosen?.id)id=String(chosen.id)}catch(_){ }
    if(!id){
      const title=document.querySelector('#sheet .detail h2')?.textContent?.trim();
      const h=(window.GUEST_HOUSES||[]).find(x=>x.name===title);
      if(h)id=String(h.id);
    }
    if(!id)return;
    const filled=favIds().has(id);
    btn.innerHTML=heartSvg(filled);
    btn.setAttribute('aria-label',filled?'Удалить из избранного':'Добавить в избранное');
  }

  function syncNavHeart(){
    const span=document.querySelector('.nav [data-s="favorites"] span');
    if(!span)return;
    span.innerHTML=heartSvg(favIds().size>0);
  }

  function refreshFavoritesUi(){
    decorateFavorites();decorateCatalog();syncOpenHeart();syncNavHeart();
  }

  function activeMarkerIcon(id){
    const active=String(id)===String(selectedId);
    return L.divIcon({
      className:'',
      html:`<div style="width:40px;height:40px;border-radius:14px;background:${active?'#f2a93b':'#111815'};border:2px solid #f2a93b;display:grid;place-items:center;color:${active?'#241707':'#f2a93b'};font-size:21px;box-shadow:${active?'0 7px 22px #0008,0 0 0 3px #f2a93b33':'0 5px 16px #0006'};transition:background .16s ease,color .16s ease,transform .16s ease">⌂</div>`,
      iconSize:[40,40],iconAnchor:[20,20]
    });
  }

  function refreshMarkerIcons(){
    if(!window.L)return;
    try{
      for(const [id,m] of Object.entries(markers||{})){
        if(m&&typeof m.setIcon==='function')m.setIcon(activeMarkerIcon(id));
      }
    }catch(_){ }
  }

  function setSelected(id){
    if(!id||String(id)===String(selectedId))return;
    selectedId=String(id);
    refreshMarkerIcons();
  }

  function centeredCard(){
    const cards=document.getElementById('cards');
    if(!cards||cards.style.display==='none')return null;
    const list=[...cards.querySelectorAll('.card[data-id]')];
    if(!list.length)return null;
    const r=cards.getBoundingClientRect(),cx=r.left+r.width/2;
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

  function bindMapCards(){
    const cards=document.getElementById('cards');
    if(!cards||cards.dataset.finalParityV12)return;
    cards.dataset.finalParityV12='1';
    cards.addEventListener('scroll',()=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;selectCentered()});
    },{passive:true});
    cards.addEventListener('touchend',()=>setTimeout(selectCentered,25),{passive:true});
    cards.addEventListener('pointerup',()=>setTimeout(selectCentered,25),{passive:true});
    new MutationObserver(()=>requestAnimationFrame(selectCentered)).observe(cards,{childList:true});
    requestAnimationFrame(selectCentered);
  }

  function bindClicks(){
    document.addEventListener('click',e=>{
      const item=e.target.closest?.('[data-id]');
      if(item?.dataset?.id)setSelected(item.dataset.id);
      if(e.target.closest?.('#sheet .fav'))setTimeout(refreshFavoritesUi,0);
    });
  }

  function observeUi(){
    const favList=document.getElementById('favList');
    if(favList)new MutationObserver(()=>requestAnimationFrame(refreshFavoritesUi)).observe(favList,{childList:true,subtree:false});
    const list=document.getElementById('list');
    if(list)new MutationObserver(()=>requestAnimationFrame(decorateCatalog)).observe(list,{childList:true});
    const sheet=document.getElementById('sheet');
    if(sheet)new MutationObserver(()=>requestAnimationFrame(()=>{
      syncOpenHeart();
      try{if(typeof chosen!=='undefined'&&chosen?.id)setSelected(chosen.id)}catch(_){ }
    })).observe(sheet,{childList:true,subtree:true});
  }

  function boot(){
    let tries=0;
    const wait=()=>{
      tries++;
      refreshFavoritesUi();bindMapCards();
      if(typeof markers==='undefined'||!document.getElementById('cards')){
        if(tries<160){setTimeout(wait,50);return}
      }
      bindClicks();observeUi();selectCentered();refreshMarkerIcons();
      window.addEventListener('storage',e=>{if(e.key===FAV_KEY)refreshFavoritesUi()});
    };
    wait();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
