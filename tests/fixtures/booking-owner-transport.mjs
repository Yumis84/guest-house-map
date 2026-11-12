// Browser-only synthetic test transport. Never imported by the product.
export function installOwnerTransport(){
 const row={id:'test-1',short_code:'KR-001',property_name:'Тестовый дом',checkin:'2026-11-01',checkout:'2026-11-03',guests:2,status:'pending',hold_status:'expired',needs_action:true,revision:1,masked_contact:'•••1234',created_at:'2026-10-25'};
 window.__bookingTest={row,calls:[],outcomes:[],listCalls:[],revealCalls:0};
 window.BOOKING_TEST_TRANSPORT=async(name,args={})=>{const t=window.__bookingTest;
 if(name==='properties')return [{id:'p1',name:'Тестовый дом'}];
 if(name==='booking_owner_capabilities')return {lifecycle:true};
 if(name==='booking_owner_list'){t.listCalls.push(args);return {rows:[{...row}],next_cursor:null};}
 if(name==='booking_owner_calendar')return {complete:false,events:[]};
 if(name==='booking_owner_detail')return {...row,history:[]};
 if(name==='booking_owner_contacts'){t.revealCalls++;return {name:'Синтетический гость',phone:'+79000001234',comment:'Тест'};}
 if(name==='booking_owner_transition'){t.calls.push({...args});const outcome=t.outcomes.shift();if(outcome==='network')throw Error('network');if(outcome==='revision_conflict'){row.revision++;throw {message:'revision_conflict',code:'P0001'};}if(outcome)throw {message:outcome,code:'P0001'};row.status={confirm:'confirmed',decline:'declined',cancel:'cancelled'}[args.p_action];row.needs_action=row.status==='confirmed';row.revision++;row.hold_status=args.p_action==='confirm'?'converted':'released';return {status:row.status,revision:row.revision};}
 throw Error('Unexpected test RPC: '+name);
 };
}
