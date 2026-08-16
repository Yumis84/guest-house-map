// Guest houses map hardening: static coordinates + reliable marker bootstrap. v6
(function(){
  if(window.__guestMapFixV6)return;
  window.__guestMapFixV6=true;

  const COORDS={
    house_001:[54.39479297519165,22.38019931284756],
    house_002:[54.398131,22.387397],
    house_003:[54.414852,22.435251],
    house_004:[54.398814,22.374054],
    house_005:[54.398814,22.374054],
    house_006:[54.398814,22.374054],
    // Exact street pin is not published in the sources we use; this is the verified Sosnovka settlement location for house 9.
    house_007:[54.38806,22.39556]
  };

  function applyCoords(){
    (window.GUEST_HOUSES||[]).forEach(h=>{
      const c=COORDS[h.id];
      if(!c)return;
      h.lat=c[0];h.lng=c[1];
    });
  }
  applyCoords();

  function mapReady(){
    try{return !!(window.L&&typeof map!=='undefined'&&map&&typeof map.fitBounds==='function')}
    catch(_){return false}
  }

  function boot(){
    applyCoords();
    let tries=0;
    const wait=()=>{
      tries++;
      if(!mapReady()||typeof addMarker!=='function'){
        if(tries<180)setTimeout(wait,50);
        return;
      }

      try{
        (window.GUEST_HOUSES||[]).forEach(h=>addMarker(h));
        if(typeof syncMarkers==='function')syncMarkers();

        const unique=[];
        const seen=new Set();
        for(const h of (window.GUEST_HOUSES||[])){
          if(!Number.isFinite(h.lat)||!Number.isFinite(h.lng))continue;
          const key=`${h.lat.toFixed(6)},${h.lng.toFixed(6)}`;
          if(seen.has(key))continue;
          seen.add(key);unique.push([h.lat,h.lng]);
        }
        if(unique.length){
          const bounds=L.latLngBounds(unique);
          map.fitBounds(bounds,{paddingTopLeft:[42,100],paddingBottomRight:[42,190],maxZoom:13,animate:false});
        }
      }catch(err){
        console.error('Guest map marker bootstrap failed',err);
      }
    };
    wait();
  }

  if(document.readyState==='complete')boot();
  else window.addEventListener('load',boot,{once:true});
})();
