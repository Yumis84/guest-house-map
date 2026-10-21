async function propertiesByCompany(client,companyIds){
  if(!companyIds.length)return[];
  const {data,error}=await client.from('properties').select('id,company_id,name,published').in('company_id',[...new Set(companyIds)]).order('name');
  if(error)throw error;
  return data||[];
}
export async function loadAccessibleProperties(client,userId){
  if(!userId)throw new Error('Authenticated user is required');
  // property_members lacks a user SELECT policy; avoid querying it from the browser.
  const {data,error}=await client.from('company_members').select('company_id').eq('user_id',userId);
  if(error)throw error;
  return propertiesByCompany(client,(data||[]).map(item=>item.company_id).filter(Boolean));
}
