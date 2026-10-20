export const STORAGE_KEY='guest-house-booking-preview-v1';
export const PROPERTIES=[
 {id:'forest-house',name:'Лесной дом',location:'Краснолесье',capacity:6,price:8200,minNights:2,accent:'#2f6b4f',units:[{id:'main-house',name:'Основной дом',capacity:6,price:8200},{id:'sauna-house',name:'Домик с баней',capacity:4,price:6900}]},
 {id:'lake-cottage',name:'Дом у озера',location:'Роминта',capacity:4,price:6500,minNights:1,accent:'#315f78',units:[{id:'lake-cottage',name:'Коттедж',capacity:4,price:6500}]},
 {id:'family-rooms',name:'Семейные номера',location:'Калининград',capacity:3,price:3900,minNights:1,accent:'#7a5a36',units:[{id:'room-1',name:'Номер 1',capacity:3,price:3900},{id:'room-2',name:'Номер 2',capacity:3,price:3900},{id:'room-3',name:'Номер 3',capacity:2,price:3400}]}
];
const DAY=86_400_000;
export const isoDate=date=>new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,10);
export function shiftDate(iso,days){const date=new Date(`${iso}T12:00:00`);date.setDate(date.getDate()+days);return isoDate(date)}
export const nights=(from,to)=>Math.round((new Date(`${to}T00:00:00Z`)-new Date(`${from}T00:00:00Z`))/DAY);
export const overlaps=(aFrom,aTo,bFrom,bTo)=>aFrom<bTo&&bFrom<aTo;
export const money=value=>new Intl.NumberFormat('ru-RU').format(value)+' ₽';
export const shortDate=value=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`));
export const propertyById=id=>PROPERTIES.find(property=>property.id===id)||PROPERTIES[0];
export const unitById=(property,id)=>property.units.find(unit=>unit.id===id)||property.units[0];
function seed(){const today=isoDate(new Date());return{version:1,items:[
 {id:'demo-booking',propertyId:'forest-house',unitId:'main-house',kind:'booking',from:shiftDate(today,3),to:shiftDate(today,6),guest:'Анна, 4 гостя',status:'confirmed',createdAt:new Date().toISOString()},
 {id:'demo-block',propertyId:'forest-house',unitId:'sauna-house',kind:'block',from:shiftDate(today,9),to:shiftDate(today,11),reason:'Уборка и обслуживание',status:'active',createdAt:new Date().toISOString()},
 {id:'demo-request',propertyId:'lake-cottage',unitIds:['lake-cottage'],kind:'request',from:shiftDate(today,5),to:shiftDate(today,8),guest:'Михаил, 2 гостя',status:'new',createdAt:new Date().toISOString()}
]}}
export function normalizeState(raw){const state=raw?.version===1&&Array.isArray(raw.items)?raw:seed();return{...state,version:1,items:state.items.map(item=>{const property=propertyById(item.propertyId),unitIds=Array.isArray(item.unitIds)?item.unitIds.filter(id=>property.units.some(unit=>unit.id===id)):[],unitId=property.units.some(unit=>unit.id===item.unitId)?item.unitId:(unitIds[0]||property.units[0].id);return{...item,unitId,unitIds:unitIds.length?unitIds:undefined,status:item.status||(item.kind==='block'?'active':'confirmed')}})}}
export function loadState(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));if(parsed?.version===1&&Array.isArray(parsed.items))return normalizeState(parsed)}catch{}const state=seed();saveState(state);return state}
export function saveState(state){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));window.dispatchEvent(new CustomEvent('booking-demo-change'))}
export function resetState(){const state=seed();saveState(state);return state}
export function itemUnitIds(item){return item.unitIds?.length?item.unitIds:[item.unitId].filter(Boolean)}
export function blockingItems(state,propertyId,unitId){return state.items.filter(item=>item.propertyId===propertyId&&(item.kind==='block'||item.kind==='booking')&&item.status!=='cancelled'&&(!unitId||itemUnitIds(item).includes(unitId)))}
export function isAvailable(state,propertyId,unitIds,from,to,ignoreId=''){const ids=Array.isArray(unitIds)?unitIds:[unitIds];return ids.length>0&&ids.every(unitId=>!blockingItems(state,propertyId,unitId).some(item=>item.id!==ignoreId&&overlaps(from,to,item.from,item.to)))}
export function validateRange(from,to){if(!from||!to)return'Выберите даты заезда и выезда.';if(nights(from,to)<1)return'Выезд должен быть позже заезда.';return''}
export function makeId(prefix){return`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`}
