// Guest houses: port of the final sauna-map UX interactions. v5
(function(){
  if(window.__guestFinalUxV5)return;
  window.__guestFinalUxV5=true;

  const style=document.createElement('style');
  style.id='guest-final-ux-v5-style';
  style.textContent=`
    /* Catalog search, synced with the map search. */
    #catalog.on{z-index:950!important}
    body:has(#catalog.on) #mapTop,#app:has(#catalog.on) #mapTop{display:none!important}
    body:has(#catalog.on) #cards,#app:has(#catalog.on) #cards{display:none!important}
    #catalog .catalog-search-wrap{position:relative;margin:0 0 14px}
    #catalog .catalog-search{width:100%;height:46px;border:1px solid #ffffff16;border-radius:15px;background:#111815;color:#f4f7f5;padding:0 46px 0 14px;outline:none;box-shadow:0 8px 24px #0003;-webkit-appearance:none;appearance:none}
    #catalog .catalog-search::placeholder{color:#829089}
    #catalog .catalog-search:focus{border-color:#f2a93b88;box-shadow:0 0 0 3px #f2a93b18,0 8px 24px #0003}
    #catalog .catalog-search-clear{position:absolute;right:5px;top:5px;width:36px;height:36px;border:0;border-radius:11px;background:transparent;color:#a9b5af;font-size:25px;line-height:1;display:none;place-items:center;padding:0}
    #mapTop .search{position:relative}
    #mapTop .search #q{padding-right:48px!important}
    #mapTop .map-search-clear{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;border-radius:11px;background:transparent;color:#d7dfdb;font-size:28px;line-height:1;display:grid;place-items:center;padding:0;opacity:.42;pointer-events:auto}
    #mapTop .search.has-query .map-search-clear{opacity:1}

    /* User location marker + recenter button. */
    .guest-user-marker{background:transparent!important;border:0!important}
    .guest-user-dot{width:22px;height:22px;border-radius:50%;background:#2f8cff;border:4px solid #fff;box-shadow:0 0 0 5px #2f8cff38,0 4px 14px #0008;position:relative}
    .guest-user-dot:after{content:"";position:absolute;inset:-9px;border:2px solid #2f8cff66;border-radius:50%;animation:guestUserPulse 2s ease-out infinite}
    @keyframes guestUserPulse{0%{transform:scale(.55);opacity:.9}75%,100%{transform:scale(1.45);opacity:0}}
    .guest-locate-btn{position:absolute;z-index:850;right:14px;bottom:208px;width:46px;height:46px;border:1px solid #ffffff18;border-radius:15px;background:#111815f2;color:#eaf3ff;display:grid;place-items:center;box-shadow:0 10px 28px #0007;font-size:23px;line-height:1;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
    .guest-locate-btn:active{transform:scale(.96)}
    .guest-locate-btn.located{color:#65a9ff}
    .guest-locate-btn[hidden]{display:none!important}

    /* Bottom sheet drag-to-close. */
    .sheet{will-change:transform;overscroll-behavior-y:contain}
    .sheet.guest-dragging{transition:none!important}
    .sheet.guest-snapping{transition:transform .22s cubic-bezier(.2,.8,.2,1)!important}
    .guest-sheet-drag-zone{position:sticky;top:0;left:50%;z-index:80;display:block;width:132px;height:34px;margin:0 auto -34px;padding:0;border:0;background:transparent;touch-action:none;cursor:grab}
    .guest-sheet-drag-zone:before{content:"";position:absolute;left:50%;top:9px;transform:translateX(-50%);width:46px;height:5px;border-radius:999px;background:#ffffffa0;box-shadow:0 1px 8px #0007}

    /* Horizontal swipe between open houses. */
    #sheet.guest-x-drag{transition:none!important;will-change:transform,opacity}
    #sheet.guest-x-anim{transition:transform .18s cubic-bezier(.2,.8,.2,1),opacity .18s ease!important;will-change:transform,opacity}

    /* Final sauna-style snap behaviour for the map cards. */
    #cards{scroll-snap-type:x mandatory;scroll-padding-inline:6vw}
    #cards .card{scroll-snap-align:center;scroll-snap-stop:normal;transition:border-color .16s ease,transform .16s ease}
    #cards .card.map-selected{border-color:#f2a93b66;transform:translateY(-2px)}
  `;
  document.head.appendChild(style);

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});
    else fn();
  }

  function ensureCatalogSearch(){
    const catalog=document.getElementById('catalog');
    const head=catalog?.querySelector('.head');
    const mapInput=document.getElementById('q');
    const mapWrap=mapInput?.closest('.search');
    if(!catalog||!head||!mapInput||!mapWrap)return false;

    let mapClear=mapWrap.querySelector('.map-search-clear');
    if(!mapClear){
      mapClear=document.createElement('button');
      mapClear.type='button';mapClear.className='map-search-clear';mapClear.textContent='×';
      mapClear.setAttribute('aria-label','Очистить поиск');
      mapWrap.appendChild(mapClear);
    }

    let wrap=catalog.querySelector('.catalog-search-wrap');
    if(!wrap){
      wrap=document.createElement('div');wrap.className='catalog-search-wrap';
      wrap.innerHTML='<input class="catalog-search" type="text" inputmode="search" autocomplete="off" aria-label="Поиск по каталогу" placeholder="Название, адрес, баня, бассейн…"><button class="catalog-search-clear" type="button" aria-label="Очистить поиск">×</button>';
      head.insertAdjacentElement('afterend',wrap);
    }
    const input=wrap.querySelector('.catalog-search');
    const clear=wrap.querySelector('.catalog-search-clear');
    if(!input||!clear)return false;

    let syncing=false;
    const updateState=()=>{
      const value=String(mapInput.value||'');
      if(input.value!==value)input.value=value;
      const has=!!value;
      mapWrap.classList.toggle('has-query',has);
      clear.style.display=has?'grid':'none';
    };
    if(!wrap.dataset.boundGuestV5){
      wrap.dataset.boundGuestV5='1';
      input.value=mapInput.value||'';
      input.addEventListener('input',()=>{
        if(syncing)return;syncing=true;
        mapInput.value=input.value;updateState();
        mapInput.dispatchEvent(new Event('input',{bubbles:true}));
        syncing=false;
      });
      clear.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();syncing=true;
        input.value='';mapInput.value='';updateState();
        mapInput.dispatchEvent(new Event('input',{bubbles:true}));syncing=false;input.focus();
      });
      mapInput.addEventListener('input',()=>{
        if(syncing)return;syncing=true;input.value=mapInput.value||'';updateState();syncing=false;
      });
      mapClear.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        if(!mapInput.value)return;syncing=true;
        mapInput.value='';input.value='';updateState();
        mapInput.dispatchEvent(new Event('input',{bubbles:true}));syncing=false;mapInput.focus();
      });
    }
    updateState();
    return true;
  }

  /* Geolocation. */
  let userMarker=null,accuracyCircle=null,lastCoords=null,watchId=null,firstFix=true;
  const REGION_CENTER={lat:54.96,lng:22.42};
  function mapReady(){try{return !!(window.L&&typeof map!=='undefined'&&map&&typeof map.setView==='function')}catch(_){return false}}
  function distanceKm(a,b){const R=6371,r=x=>x*Math.PI/180,dLat=r(b.lat-a.lat),dLng=r(b.lng-a.lng);const s=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(s))}
  function locationIcon(){return L.divIcon({className:'guest-user-marker',html:'<div class="guest-user-dot"></div>',iconSize:[22,22],iconAnchor:[11,11]})}
  function syncLocateVisibility(){const btn=document.querySelector('.guest-locate-btn'),mapTab=document.querySelector('.nav [data-s="map"]');if(btn)btn.hidden=!!mapTab&&!mapTab.classList.contains('on')}
  function locateButton(){
    let btn=document.querySelector('.guest-locate-btn');if(btn)return btn;
    const app=document.getElementById('app');if(!app)return null;
    btn=document.createElement('button');btn.type='button';btn.className='guest-locate-btn';btn.innerHTML='◎';btn.title='Моё местоположение';btn.setAttribute('aria-label','Показать моё местоположение');
    btn.addEventListener('click',()=>{if(lastCoords&&mapReady()){map.setView([lastCoords.latitude,lastCoords.longitude],Math.max(15,map.getZoom?.()||15),{animate:true});return}requestLocation(true)});
    app.appendChild(btn);syncLocateVisibility();return btn;
  }
  function updatePosition(pos){
    if(!mapReady())return;const c=pos.coords;lastCoords=c;const ll=[c.latitude,c.longitude];locateButton()?.classList.add('located');
    if(!userMarker){userMarker=L.marker(ll,{icon:locationIcon(),zIndexOffset:10000,keyboard:false}).addTo(map);userMarker.bindPopup('<b>Вы здесь</b>')}else userMarker.setLatLng(ll);
    if(Number.isFinite(c.accuracy)&&c.accuracy>0&&c.accuracy<=2000){if(!accuracyCircle)accuracyCircle=L.circle(ll,{radius:c.accuracy,interactive:false,weight:1,opacity:.45,fillOpacity:.08,color:'#2f8cff',fillColor:'#2f8cff'}).addTo(map);else accuracyCircle.setLatLng(ll).setRadius(c.accuracy)}
    if(firstFix){firstFix=false;const here={lat:c.latitude,lng:c.longitude};if(distanceKm(here,REGION_CENTER)<=180)map.setView(ll,Math.max(14,map.getZoom?.()||14),{animate:true})}
  }
  function locationError(err,manual){locateButton()?.classList.remove('located');if(!manual)return;let msg='Не удалось определить местоположение';if(err?.code===1)msg='Разрешите доступ к геопозиции в браузере';try{if(typeof toast==='function')toast(msg)}catch(_){}}
  function startWatch(){if(watchId!==null||!navigator.geolocation)return;try{watchId=navigator.geolocation.watchPosition(updatePosition,()=>{},{enableHighAccuracy:true,maximumAge:15000,timeout:12000})}catch(_){}}
  function requestLocation(manual=false){if(!navigator.geolocation){locationError(null,manual);return}navigator.geolocation.getCurrentPosition(pos=>{updatePosition(pos);startWatch()},err=>locationError(err,manual),{enableHighAccuracy:true,maximumAge:30000,timeout:10000})}

  /* Downward drag to close. */
  let dragActive=false,dragStartY=0,dragLastY=0,dragAt=0,dragPointer=null;
  const detailOverlay=()=>document.getElementById('detail');
  const sheet=()=>document.getElementById('sheet');
  function ensureDragHandle(){const s=sheet();if(!s||!s.children.length)return;if(!s.querySelector('.guest-sheet-drag-zone')){const h=document.createElement('button');h.type='button';h.className='guest-sheet-drag-zone';h.setAttribute('aria-label','Смахнуть карточку вниз, чтобы закрыть');s.prepend(h)}}
  function closeSheet(){const d=detailOverlay(),s=sheet();if(!d||!s)return;s.classList.remove('guest-dragging');s.classList.add('guest-snapping');s.style.transform='translateY(110vh)';setTimeout(()=>{d.classList.remove('on');s.classList.remove('guest-snapping');s.style.transform='';s.style.opacity='';s.scrollTop=0},210)}
  function snapSheet(){const s=sheet();if(!s)return;s.classList.remove('guest-dragging');s.classList.add('guest-snapping');s.style.transform='translateY(0)';setTimeout(()=>s.classList.remove('guest-snapping'),230)}
  function onDragDown(e){const h=e.target.closest('.guest-sheet-drag-zone'),s=sheet(),d=detailOverlay();if(!h||!s||!d?.classList.contains('on'))return;if(s.scrollTop>2){s.scrollTo({top:0,behavior:'smooth'});return}dragActive=true;dragPointer=e.pointerId;dragStartY=dragLastY=e.clientY;dragAt=performance.now();s.classList.remove('guest-snapping');s.classList.add('guest-dragging');try{h.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()}
  function onDragMove(e){if(!dragActive||e.pointerId!==dragPointer)return;const s=sheet();if(!s)return;dragLastY=e.clientY;const dy=Math.max(0,dragLastY-dragStartY);s.style.transform=`translateY(${Math.min(dy,window.innerHeight*.9)}px)`;e.preventDefault()}
  function onDragEnd(e){if(!dragActive||e.pointerId!==dragPointer)return;const dy=Math.max(0,dragLastY-dragStartY),elapsed=Math.max(1,performance.now()-dragAt),velocity=dy/elapsed;dragActive=false;dragPointer=null;if(dy>=85||velocity>=.42)closeSheet();else snapSheet()}

  /* Horizontal swipe between houses from the text/details area. */
  let xTracking=false,xLocked=false,xCancelled=false,x0=0,y0=0,xLast=0,xAt=0;
  function currentHouse(){try{if(typeof chosen!=='undefined'&&chosen)return chosen}catch(_){}const name=sheet()?.querySelector('.detail h2')?.textContent?.trim();try{return houses.find(h=>h.name===name)||null}catch(_){return null}}
  function currentHouseList(){
    try{
      if(document.getElementById('favorites')?.classList.contains('on')){const ids=[...document.querySelectorAll('#favList [data-id]')].map(el=>el.dataset.id);return ids.map(id=>houses.find(h=>h.id===id)).filter(Boolean)}
      if(typeof filtered==='function')return filtered();
      return houses||[];
    }catch(_){return []}
  }
  function neighbor(direction){const cur=currentHouse(),list=currentHouseList();if(!cur||!list.length)return null;const i=list.findIndex(h=>h.id===cur.id);return i<0?null:(list[i+direction]||null)}
  function interactive(target){return !!target.closest('button,a,input,select,textarea,label,.gh-gallery,.gh-gallery-track,.gh-gallery-nav,.gh-gallery-source')}
  function resetX(animate=true){const s=sheet();if(!s)return;s.classList.remove('guest-x-drag');if(animate)s.classList.add('guest-x-anim');s.style.transform='translateX(0)';s.style.opacity='1';setTimeout(()=>s.classList.remove('guest-x-anim'),210)}
  function alignUnderlying(id){requestAnimationFrame(()=>{const catalog=document.getElementById('catalog'),favorites=document.getElementById('favorites');if(favorites?.classList.contains('on')){favorites.querySelector(`[data-id="${id}"]`)?.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});return}if(catalog?.classList.contains('on')){catalog.querySelector(`[data-id="${id}"]`)?.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});return}const cards=document.getElementById('cards'),card=cards?.querySelector(`.card[data-id="${id}"]`);if(card){const left=card.offsetLeft-(cards.clientWidth-card.clientWidth)/2;cards.scrollTo({left:Math.max(0,left),behavior:'smooth'})}})}
  function switchHouse(target,direction){const s=sheet();if(!s||!target)return resetX();const exitX=direction>0?-window.innerWidth:window.innerWidth;s.classList.remove('guest-x-drag');s.classList.add('guest-x-anim');s.style.transform=`translateX(${exitX}px)`;s.style.opacity='.45';setTimeout(()=>{try{if(typeof window.openHouse!=='function')throw new Error();window.openHouse(target.id);s.scrollTop=0;ensureDragHandle();alignUnderlying(target.id);s.classList.remove('guest-x-anim');s.style.transform=`translateX(${-exitX*.24}px)`;s.style.opacity='.72';requestAnimationFrame(()=>requestAnimationFrame(()=>{s.classList.add('guest-x-anim');s.style.transform='translateX(0)';s.style.opacity='1';setTimeout(()=>s.classList.remove('guest-x-anim'),210)}))}catch(_){resetX()}},165)}
  function onXStart(e){const s=sheet(),d=detailOverlay();if(!s||!d?.classList.contains('on')||e.touches.length!==1)return;if(!e.target.closest('.detail')||interactive(e.target))return;xTracking=true;xLocked=false;xCancelled=false;x0=xLast=e.touches[0].clientX;y0=e.touches[0].clientY;xAt=performance.now()}
  function onXMove(e){if(!xTracking||xCancelled||e.touches.length!==1)return;const s=sheet();if(!s)return;const x=e.touches[0].clientX,y=e.touches[0].clientY,dx=x-x0,dy=y-y0;xLast=x;if(!xLocked){if(Math.abs(dx)<10&&Math.abs(dy)<10)return;if(Math.abs(dy)>=Math.abs(dx)*.9){xCancelled=true;xTracking=false;return}xLocked=true;s.classList.remove('guest-x-anim');s.classList.add('guest-x-drag')}e.preventDefault();const dir=dx<0?1:-1,has=!!neighbor(dir),shown=has?dx:dx*.26,cap=Math.min(window.innerWidth*.72,Math.abs(shown)),tx=Math.sign(shown)*cap;s.style.transform=`translateX(${tx}px)`;s.style.opacity=String(Math.max(.72,1-Math.abs(tx)/window.innerWidth*.32))}
  function onXEnd(){if(!xTracking&&!xLocked)return;const s=sheet(),dx=xLast-x0,elapsed=Math.max(1,performance.now()-xAt),velocity=Math.abs(dx)/elapsed,wasLocked=xLocked;xTracking=false;xLocked=false;if(!s||!wasLocked||xCancelled){xCancelled=false;return}const dir=dx<0?1:-1,target=neighbor(dir),threshold=Math.min(105,window.innerWidth*.24);if(target&&(Math.abs(dx)>=threshold||velocity>=.48))switchHouse(target,dir);else resetX(true)}

  /* Bottom map-card carousel: snap + keep the centered house aligned on map. */
  function bindMapCards(){
    const cards=document.getElementById('cards');if(!cards||cards.dataset.guestMapSwipeV5)return;cards.dataset.guestMapSwipeV5='1';let currentId=null,raf=0,panTimer=0;
    const visible=()=>cards.style.display!=='none';
    const centered=()=>{const list=[...cards.querySelectorAll('.card[data-id]')];if(!list.length)return null;const r=cards.getBoundingClientRect(),cx=r.left+r.width/2;let best=null,dist=Infinity;for(const c of list){const cr=c.getBoundingClientRect();if(cr.right<r.left||cr.left>r.right)continue;const d=Math.abs((cr.left+cr.width/2)-cx);if(d<dist){dist=d;best=c}}return best||list[0]};
    const pan=id=>{clearTimeout(panTimer);panTimer=setTimeout(()=>{if(!visible()||id!==currentId)return;try{const h=houses.find(x=>x.id===id);if(h?.lat&&h?.lng&&map)map.panTo([h.lat,h.lng],{animate:true,duration:.32,easeLinearity:.35})}catch(_){}},90)};
    const select=()=>{if(!visible())return;const c=centered();if(!c)return;const id=c.dataset.id;cards.querySelectorAll('.card.map-selected').forEach(x=>x.classList.remove('map-selected'));c.classList.add('map-selected');if(id!==currentId){currentId=id;try{chosen=houses.find(h=>h.id===id)||chosen}catch(_){}}pan(id)};
    const onScroll=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;select()})};cards.addEventListener('scroll',onScroll,{passive:true});cards.addEventListener('touchend',()=>setTimeout(select,35),{passive:true});cards.addEventListener('pointerup',()=>setTimeout(select,35),{passive:true});new MutationObserver(()=>requestAnimationFrame(select)).observe(cards,{childList:true});requestAnimationFrame(select);
  }

  function boot(){
    let tries=0;
    const wait=()=>{
      tries++;
      ensureCatalogSearch();locateButton();bindMapCards();
      const s=sheet();
      if(s&&!s.dataset.guestGesturesV5){
        s.dataset.guestGesturesV5='1';ensureDragHandle();
        s.addEventListener('pointerdown',onDragDown);s.addEventListener('pointermove',onDragMove);s.addEventListener('pointerup',onDragEnd);s.addEventListener('pointercancel',onDragEnd);
        s.addEventListener('touchstart',onXStart,{passive:true});s.addEventListener('touchmove',onXMove,{passive:false});s.addEventListener('touchend',onXEnd,{passive:true});s.addEventListener('touchcancel',onXEnd,{passive:true});
        new MutationObserver(()=>requestAnimationFrame(ensureDragHandle)).observe(s,{childList:true,subtree:false});
      }
      if(mapReady())requestLocation(false);else if(tries<160){setTimeout(wait,50);return}
      document.addEventListener('click',e=>{if(e.target.closest('.nav [data-s]'))setTimeout(syncLocateVisibility,0)});
      window.addEventListener('pageshow',syncLocateVisibility);
    };
    wait();
  }

  ready(boot);
})();
