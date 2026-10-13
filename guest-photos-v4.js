// Real guest-house photo galleries. Sources are listed per property and kept external so they can be replaced later with local assets. v4
(function(){
  if(window.__guestHousePhotosV4)return;
  window.__guestHousePhotosV4=true;

  const SOURCES={
    house_001:{
      sourceUrl:'https://rominten.ru/',
      sourceLabel:'Материалы гостевого дома «У Степана»',
      images:[
        'assets/stepan/stepan-01.webp',
        'assets/stepan/stepan-02.webp',
        'assets/stepan/stepan-03.webp',
        'assets/stepan/stepan-04.webp',
        'assets/stepan/stepan-05.webp',
        'assets/stepan/stepan-06.webp',
        'assets/stepan/stepan-07.webp',
        'assets/stepan/stepan-08.webp',
        'assets/stepan/stepan-09.webp'
      ]
    },
    house_002:{
      sourceUrl:'https://wystynez.ru/p101.htm',
      sourceLabel:'Фотографии усадьбы Титова',
      images:[
        'assets/titov/titov-01.webp',
        'assets/titov/titov-02.webp',
        'assets/titov/titov-03.webp',
        'assets/titov/titov-04.webp',
        'assets/titov/titov-05.webp',
        'assets/titov/titov-06.webp',
        'assets/titov/titov-07.webp',
        'assets/titov/titov-08.webp',
        'assets/titov/titov-09.webp',
        'assets/titov/titov-10.webp',
        'assets/titov/titov-11.webp'
      ]
    },
    house_003:{
      sourceUrl:'https://rominta.ru/',
      sourceLabel:'Фотографии Rominta Guest House',
      images:[
        'assets/rominta/rominta-02.webp',
        'assets/rominta/rominta-04.webp',
        'assets/rominta/rominta-05.webp',
        'assets/rominta/rominta-06.webp',
        'assets/rominta/rominta-07.webp',
        'assets/rominta/rominta-03.webp',
        'assets/rominta/rominta-08.webp',
        'assets/rominta/rominta-contact.webp',
      ]
    },
    house_004:{
          sourceUrl:'https://tochkakrasnolesye.tilda.ws/',
      sourceLabel:'Фотографии комплекса «Точка»',
      images:[
        'assets/tochka/tochka-03.webp',
        'assets/tochka/tochka-01.webp',
        'assets/tochka/tochka-02.webp',
        'assets/tochka/tochka-04.webp',
        'assets/tochka/tochka-05.webp',
        'assets/tochka/tochka-06.webp',
        'assets/tochka/tochka-07.webp',
        'assets/tochka/tochka-08.webp',
        'assets/tochka/tochka-09.webp',
        'assets/tochka/tochka-10.webp'
      ]
    },
    house_005:{
          sourceUrl:'https://tochkakrasnolesye.tilda.ws/',
      sourceLabel:'Фотографии комплекса «Точка»',
      images:[
        'assets/tochka/tochka-03.webp',
        'assets/tochka/tochka-01.webp',
        'assets/tochka/tochka-02.webp',
        'assets/tochka/tochka-04.webp',
        'assets/tochka/tochka-05.webp',
        'assets/tochka/tochka-06.webp',
        'assets/tochka/tochka-07.webp',
        'assets/tochka/tochka-08.webp',
        'assets/tochka/tochka-09.webp',
        'assets/tochka/tochka-10.webp'
      ]
    },
    house_006:{
          sourceUrl:'https://tochkakrasnolesye.tilda.ws/',
      sourceLabel:'Фотографии комплекса «Точка»',
      images:[
        'assets/tochka/tochka-03.webp',
        'assets/tochka/tochka-01.webp',
        'assets/tochka/tochka-02.webp',
        'assets/tochka/tochka-04.webp',
        'assets/tochka/tochka-05.webp',
        'assets/tochka/tochka-06.webp',
        'assets/tochka/tochka-07.webp',
        'assets/tochka/tochka-08.webp',
        'assets/tochka/tochka-09.webp',
        'assets/tochka/tochka-10.webp'
      ]
    },
    house_007:{
          sourceUrl:'https://vk.ru/sheldenhotel',
      sourceLabel:'Фотографии «Шельден»',
      images:[
        'assets/shelden/shelden-03.webp',
        'assets/shelden/shelden-01.webp',
        'assets/shelden/shelden-02.webp',
        'assets/shelden/shelden-04.webp',
        'assets/shelden/shelden-05.webp',
        'assets/shelden/shelden-06.webp',
        'assets/shelden/shelden-07.webp',
        'assets/shelden/shelden-08.webp',
        'assets/shelden/shelden-09.webp',
        'assets/shelden/shelden-10.webp',
        'assets/shelden/shelden-11.webp',
        'assets/shelden/shelden-12.webp',
        'assets/shelden/shelden-13.webp',
        'assets/shelden/shelden-14.webp'
      ]
    },
    house_008:{
          sourceUrl:'http://puscha.tilda.ws/',
      sourceLabel:'Фотографии эко-комплекса «Пуща»',
      images:[
        'assets/puscha/puscha-05.webp',
        'assets/puscha/puscha-01.webp',
        'assets/puscha/puscha-02.webp',
        'assets/puscha/puscha-03.webp',
        'assets/puscha/puscha-04.webp',
        'assets/puscha/puscha-06.webp',
        'assets/puscha/puscha-07.webp'
      ]
    },
    house_009:{
          sourceUrl:'http://www.usadbazaeca.ru/',
      sourceLabel:'Фотографии «Усадьбы Заеца»',
      images:[
        'assets/zaec/zaec-01.webp',
        'assets/zaec/zaec-02.webp',
        'assets/zaec/zaec-03.webp',
        'assets/zaec/zaec-04.webp',
        'assets/zaec/zaec-05.webp',
        'assets/zaec/zaec-06.webp',
        'assets/zaec/zaec-07.webp',
        'assets/zaec/zaec-08.webp',
        'assets/zaec/zaec-09.webp',
        'assets/zaec/zaec-10.webp'
      ]
    }
  };

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const houseById=id=>(window.GUEST_HOUSES||[]).find(h=>h.id===id);

  function applyPhotoData(){
    for(const [id,src] of Object.entries(SOURCES)){
      const h=houseById(id);
      if(!h)continue;
      h.photos=[...src.images];
      h.photoSourceUrl=src.sourceUrl;
      h.photoSourceLabel=src.sourceLabel;
      h.photoScope=src.scope||'';
    }
  }

  function installStyles(){
    if(document.getElementById('guest-house-photo-style-v4'))return;
    const style=document.createElement('style');
    style.id='guest-house-photo-style-v4';
    style.textContent=`
      .thumb.gh-photo-thumb{padding:0!important;overflow:hidden!important;background:#18221e!important;font-size:0!important}
      .thumb.gh-photo-thumb img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}

      .hero.gh-photo-hero{overflow:hidden!important;font-size:0!important;background:#111815!important;isolation:isolate}
      .hero.gh-photo-hero:after{z-index:2!important;pointer-events:none!important}
      .hero.gh-photo-hero>.fav,.hero.gh-photo-hero>.x{z-index:6!important;font-size:19px!important}
      .gh-gallery{position:absolute;inset:0;z-index:1;overflow:hidden;background:#111815;touch-action:pan-y}
      .gh-gallery-track{display:flex;width:100%;height:100%;transition:transform .24s ease;will-change:transform}
      .gh-gallery-slide{min-width:100%;height:100%;position:relative;background:#18221e;display:grid;place-items:center;color:#a9b5af;font:700 12px system-ui}
      .gh-gallery-slide img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}
      .gh-gallery-slide img.gh-photo-failed{display:none}.gh-gallery-slide span{display:none}.gh-gallery-slide:has(img.gh-photo-failed) span{display:block;position:absolute;inset:0;display:grid;place-items:center;background:#111815;color:#a9b5af}
      .gh-gallery-nav{position:absolute;z-index:7;top:50%;transform:translateY(-50%);width:34px;height:42px;border:0;border-radius:12px;background:#09100db8;color:#fff;font:800 22px/1 system-ui;display:grid;place-items:center;backdrop-filter:blur(5px)}
      .gh-gallery-prev{left:10px}.gh-gallery-next{right:10px}
      .gh-gallery-meta{position:absolute;z-index:7;left:12px;right:12px;bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;pointer-events:none}
      .gh-gallery-source,.gh-gallery-count{padding:5px 8px;border-radius:999px;background:#09100dc9;color:#eef3f0;font:700 10px/1.2 system-ui;backdrop-filter:blur(6px);white-space:nowrap;max-width:70%;overflow:hidden;text-overflow:ellipsis}
      .gh-gallery-source{pointer-events:auto;text-decoration:none;color:#fff}
      .gh-gallery-source:hover{color:#ffd37f}
      .gh-gallery-dots{position:absolute;z-index:7;left:50%;bottom:39px;transform:translateX(-50%);display:flex;gap:5px;pointer-events:none}
      .gh-gallery-dot{width:6px;height:6px;border-radius:999px;background:#ffffff70;box-shadow:0 1px 5px #0008}
      .gh-gallery-dot.on{width:17px;background:#ffd37f}
      @media(max-width:520px){.gh-gallery-nav{width:31px;height:39px}.gh-gallery-source{max-width:68%}}
    `;
    document.head.appendChild(style);
  }

  function setThumb(el,h){
    const thumb=el.querySelector('.thumb');
    const url=h?.photos?.[0];
    if(!thumb||!url)return;
    if(thumb.dataset.ghPhoto===url)return;
    thumb.dataset.ghPhoto=url;
    thumb.classList.add('gh-photo-thumb');
    thumb.innerHTML=`<img src="${esc(url)}" alt="${esc(h.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    const img=thumb.querySelector('img');
    img.onerror=()=>{
      thumb.classList.remove('gh-photo-thumb');
      thumb.innerHTML='⌂';
      delete thumb.dataset.ghPhoto;
    };
  }

  function refreshThumbs(){
    document.querySelectorAll('[data-id]').forEach(el=>{
      const h=houseById(el.dataset.id);
      if(h)setThumb(el,h);
    });
  }

  function mountGallery(id){
    const h=houseById(id);
    const hero=document.querySelector('#sheet .hero');
    if(!hero||!h?.photos?.length)return;
    const old=hero.querySelector('.gh-gallery');
    if(old&&old.dataset.houseId===id)return;
    old?.remove();
    hero.classList.add('gh-photo-hero');

    const gallery=document.createElement('div');
    gallery.className='gh-gallery';
    gallery.dataset.houseId=id;
    const slides=h.photos.map((url,i)=>`<div class="gh-gallery-slide"><img src="${esc(url)}" alt="${esc(h.name)} — фото ${i+1}" decoding="async" referrerpolicy="no-referrer"><span>Фото недоступно</span></div>`).join('');
    gallery.innerHTML=`<div class="gh-gallery-track">${slides}</div>${h.photos.length>1?'<button class="gh-gallery-nav gh-gallery-prev" type="button" aria-label="Предыдущее фото">‹</button><button class="gh-gallery-nav gh-gallery-next" type="button" aria-label="Следующее фото">›</button>':''}<div class="gh-gallery-dots">${h.photos.map((_,i)=>`<i class="gh-gallery-dot ${i===0?'on':''}"></i>`).join('')}</div><div class="gh-gallery-meta"><a class="gh-gallery-source" href="${esc(h.photoSourceUrl||'#')}" target="_blank" rel="noopener noreferrer">${esc(h.photoScope||h.photoSourceLabel||'Источник фото')}</a><span class="gh-gallery-count">1 / ${h.photos.length}</span></div>`;
    hero.insertBefore(gallery,hero.firstChild);

    gallery.querySelectorAll('img').forEach(img=>{img.onerror=()=>img.classList.add('gh-photo-failed')});
    const track=gallery.querySelector('.gh-gallery-track');
    const dots=[...gallery.querySelectorAll('.gh-gallery-dot')];
    const count=gallery.querySelector('.gh-gallery-count');
    let index=0;
    const show=n=>{
      const max=h.photos.length-1;
      index=Math.max(0,Math.min(max,n));
      track.style.transform=`translateX(${-index*100}%)`;
      dots.forEach((d,i)=>d.classList.toggle('on',i===index));
      count.textContent=`${index+1} / ${h.photos.length}`;
    };
    gallery.querySelector('.gh-gallery-prev')?.addEventListener('click',e=>{e.stopPropagation();show(index-1)});
    gallery.querySelector('.gh-gallery-next')?.addEventListener('click',e=>{e.stopPropagation();show(index+1)});
    let startX=null;
    gallery.addEventListener('touchstart',e=>{startX=e.touches?.[0]?.clientX??null},{passive:true});
    gallery.addEventListener('touchend',e=>{
      if(startX==null)return;
      const end=e.changedTouches?.[0]?.clientX??startX;
      const dx=end-startX;startX=null;
      if(Math.abs(dx)>38)show(index+(dx<0?1:-1));
    },{passive:true});
  }

  function wrapOpenHouse(){
    if(typeof window.openHouse!=='function')return false;
    if(window.openHouse.__guestPhotoWrapped)return true;
    const original=window.openHouse;
    const wrapped=function(id){
      const result=original.apply(this,arguments);
      requestAnimationFrame(()=>mountGallery(id));
      return result;
    };
    wrapped.__guestPhotoWrapped=true;
    window.openHouse=wrapped;
    return true;
  }

  function start(){
    applyPhotoData();
    installStyles();
    wrapOpenHouse();
    refreshThumbs();
    const observer=new MutationObserver(()=>refreshThumbs());
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('guest-house:render',refreshThumbs);
  }

  if(document.readyState==='complete')start();
  else window.addEventListener('load',start,{once:true});
})();
