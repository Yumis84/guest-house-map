const missingRelation=error=>['42P01','PGRST205'].includes(error?.code);
async function memberships(client,table,columns,userId){const {data,error}=await client.from(table).select(columns).eq('user_id',userId);if(error&&missingRelation(error))return[];if(error)throw error;return data||[];}
async function propertiesBy(client,column,values){if(!values.length)return[];const {data,error}=await client.from('properties').select('id,company_id,name,published').in(column,[...new Set(values)]).order('name');if(error)throw error;return data||[];}
export async function loadAccessibleProperties(client,userId){
  if(!userId)throw new Error('Authenticated user is required');
  const [propertyMemberships,companyMemberships]=await Promise.all([memberships(client,'property_members','property_id',userId),memberships(client,'company_members','company_id',userId)]);
  const [direct,company]=await Promise.all([propertiesBy(client,'id',propertyMemberships.map(item=>item.property_id).filter(Boolean)),propertiesBy(client,'company_id',companyMemberships.map(item=>item.company_id).filter(Boolean))]);
  return [...new Map([...direct,...company].map(item=>[item.id,item])).values()].sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
}
