window.GUEST_HOUSES=[
  {id:'house_001',name:'Гостевой дом «У Степана»',address:'Калининградская область, Нестеровский муниципальный округ, пос. Краснолесье, ул. Сосновая, 7',lat:54.39479297519165,lng:22.38019931284756,capacity:12,price:7000,amenities:['Wi‑Fi','Бесплатная парковка','Баня','Мангал и барбекю','Общая кухня','Сад','Терраса','Прокат велосипедов','Можно с собаками'],phone:'+79062194239',site:'https://rominten.ru',description:'Уютный гостевой дом рядом с Виштынецким национальным парком и Роминтенской пущей. Заезд с 14:00, выезд до 12:00. Подходит для семейного отдыха, велопоездок и отдыха на природе.',active:true},
  {id:'house_002',name:'Гостевой дом «Усадьба Титова»',address:'Калининградская область, Нестеровский муниципальный округ, с. Краснолесье, ул. Сосновая, д. 27',lat:54.398131,lng:22.387397,capacity:null,price:null,amenities:['Баня','Рыбалка','Охота','Беседка','Банкетный зал с камином','Кондиционер','Оборудованная кухня','Бесплатная парковка','Питание по запросу','Конные прогулки','Байдарки'],description:'Гостевой дом на окраине Роминтенской пущи рядом с рекой Красная. Принимает гостей круглый год, подходит для семей, групп и мероприятий.',active:true},
  {id:'house_003',name:'Rominta Guest House',address:'Калининградская область, Нестеровский район, пос. Дмитриевка, д. 10',lat:54.414852,lng:22.435251,capacity:10,price:8000,amenities:['Wi‑Fi','Трёхразовое питание','Баня','Чан','Беседки','Батут','Качели','Гамак','Байдарки','Экскурсии','Можно с собаками','Бесплатная парковка'],phone:'+79632988382',site:'https://rominta.ru',description:'Гостевой дом семьи Добровольских на окраине Роминтенской пущи. Домашняя атмосфера, питание из фермерских продуктов, баня, чан и активный отдых.',active:true},
  {id:'house_004',name:'База «Точка Краснолесье» — Дом A‑frame',address:'Калининградская область, Нестеровский район, пос. Краснолесье, ул. Центральная, д. 8',lat:54.398814,lng:22.374054,capacity:4,price:9000,amenities:['Веранда','Летняя кухня','Мангал','Кострище','Качели','Бассейн летом','Детская площадка','Охраняемая парковка','Кофейня','Баня','Банный чан','Фурако','Прокат велосипедов'],phone:'+79814617768',description:'Каркасные эко‑домики A‑frame с верандой и собственной зоной отдыха. Доступна инфраструктура комплекса «Точка Краснолесье».',active:true},
  {id:'house_005',name:'База «Точка Краснолесье» — Номер «Комфорт»',address:'Калининградская область, Нестеровский район, пос. Краснолесье, ул. Центральная, д. 8',lat:54.398814,lng:22.374054,capacity:4,price:7000,amenities:['Бассейн летом','Баня','Банный чан','Фурако','Барбекю','Кофейня','Детская площадка','Охраняемая парковка','Прокат велосипедов'],phone:'+79814617768',description:'Комфортный номер до 4 гостей с доступом ко всей инфраструктуре комплекса «Точка Краснолесье».',active:true},
  {id:'house_006',name:'База «Точка Краснолесье» — Номер «Для двоих»',address:'Калининградская область, Нестеровский район, пос. Краснолесье, ул. Центральная, д. 8',lat:54.398814,lng:22.374054,capacity:2,price:6000,amenities:['Бассейн летом','Баня','Банный чан','Фурако','Барбекю','Кофейня','Охраняемая парковка','Прокат велосипедов'],phone:'+79814617768',description:'Романтичный номер для двух гостей в комплексе «Точка Краснолесье».',active:true},
  {id:'house_007',name:'Гостевой дом «Шельден»',address:'Калининградская область, Нестеровский район, пос. Сосновка, д. 9',lat:54.38806,lng:22.39556,capacity:16,price:null,amenities:['Санузел в каждом номере','Семейный номер','Кухня‑столовая','Терраса','Зал для мероприятий','Велосипеды','Квадроциклы','Байдарки','Берег озера','Животные по согласованию'],description:'Гостевой дом в заповедных лесах Роминтенской пущи на берегу озера. Три здания, номера с собственными санузлами и активный отдых.',active:true}
];

// Load integrations/enhancements after the base data is available.
(function(){
  const s=document.createElement('script');
  s.src='guest-n8n-v1.js?v=2';
  s.defer=true;
  document.head.appendChild(s);

  const compact=document.createElement('script');
  compact.src='guest-chat-compact-v3.js?v=3';
  compact.defer=true;
  document.head.appendChild(compact);

  const photos=document.createElement('script');
  photos.src='guest-photos-v4.js?v=4';
  photos.defer=true;
  document.head.appendChild(photos);

  const ux=document.createElement('script');
  ux.src='guest-final-ux-v5.js?v=5';
  ux.defer=true;
  document.head.appendChild(ux);

  const mapFix=document.createElement('script');
  mapFix.src='guest-map-fix-v6.js?v=6';
  mapFix.defer=true;
  document.head.appendChild(mapFix);

  const gallery=document.createElement('script');
  gallery.src='guest-gallery-large-v7.js?v=7';
  gallery.defer=true;
  document.head.appendChild(gallery);

  const swipe=document.createElement('script');
  swipe.src='guest-sheet-swipe-v8.js?v=8';
  swipe.defer=true;
  document.head.appendChild(swipe);
})();
