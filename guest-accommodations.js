// Accommodation data v1. Catalog-only; no booking API changes.
window.GUEST_ACCOMMODATIONS={
  schemaVersion:1,
  roomTypes:[
    {id:"point_aframe",propertyId:"house_004",title:"A-frame домик",capacity:4,description:"Отдельный A-frame домик с завтраком. Три домика одной категории.",bookingHouseId:"house_004",bookingMode:"inquiry"},
    {id:"house_005",propertyId:"house_004",title:"Номер «Комфорт»",capacity:null,description:"Гостиничный номер с завтраком. Вместимость уточняется у владельца.",bookingHouseId:"house_005",bookingMode:"inquiry"},
    {id:"house_006",propertyId:"house_004",title:"Номер «Для двоих»",capacity:2,description:"Гостиничный номер для двоих с завтраком.",bookingHouseId:"house_006",bookingMode:"inquiry"}
  ],
  units:[
    {id:"point_aframe_01",roomTypeId:"point_aframe",label:"Домик №1"},
    {id:"point_aframe_02",roomTypeId:"point_aframe",label:"Домик №2"},
    {id:"point_aframe_03",roomTypeId:"point_aframe",label:"Домик №3"},
    {id:"point_comfort_01",roomTypeId:"house_005",label:"Номер «Комфорт»"},
    {id:"point_double_01",roomTypeId:"house_006",label:"Номер «Для двоих»"}
  ]
};
