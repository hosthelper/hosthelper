function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
export default async function(req){
  if(req.method!=='GET')return reply({error:'method_not_allowed'},405);
  const storeId=Netlify.env.get('PORTONE_STORE_ID');
  const channelKey=Netlify.env.get('PORTONE_CHANNEL_KEY');
  if(!storeId||!channelKey)return reply({error:'portone_public_config_unavailable'},503);
  return reply({storeId,channelKey});
}
