// One exact locality parser for the catalog and map filters.
(function(root){
  function localityOf(house){
    if(house.locality)return house.locality.trim();
    const match=String(house.address||'').match(/(?:^|,)\s*(?:пос[её]лок|пос\.?|п\.?|село|с\.?|деревня|дер\.?)\s+([^,]+)/iu);
    return match?match[1].trim():'';
  }
  const normalize=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();
  root.GuestLocality={localityOf,matches:(house,value)=>!value||normalize(localityOf(house))===normalize(value)};
})(globalThis);
