const {matches,redis,validate,save,baseline,key,redisURL,redisToken}=require('../lib/store');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method))return res.status(405).end();
  if(!process.env.DASHBOARD_PASSWORD)return res.status(503).json({error:'Set DASHBOARD_PASSWORD in Vercel and redeploy.'});
  if(!matches(req.headers.authorization,'Bearer '+process.env.DASHBOARD_PASSWORD))return res.status(401).json({error:'Enter the team password.'});
  try{
    if(req.method==='GET'){
      const stored=redisURL&&redisToken?await redis(['GET',key]):null;
      const sync=redisURL&&redisToken?await redis(['GET','rakshith:onedrive:last-check']):null;
      return res.status(200).json({...stored?JSON.parse(stored):baseline,cloudSync:sync?JSON.parse(sync):null});
    }
    if(!matches(req.headers['x-publisher-key'],process.env.PUBLISHER_KEY))return res.status(403).json({error:'Publisher key is missing or incorrect.'});
    if(!redisURL||!redisToken)return res.status(503).json({error:'Connect Upstash Redis to enable shared updates.'});
    const book=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!validate(book))return res.status(422).json({error:'Workbook dates or totals failed validation.'});
    const ok=await save(book);
    if(!ok)return res.status(409).json({error:'The shared report already has a newer invoice date.'});
    return res.status(200).json({saved:true});
  }catch{return res.status(503).json({error:'Could not access shared storage. Retry after checking the Redis connection.'})}
};
