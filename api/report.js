const { timingSafeEqual, createHash } = require('node:crypto');
const baseline = require('../private/snapshot.json');
const key = 'rakshith:daily-sales:v1';
const redisURL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
function matches(value, secret) {
  if (!secret || typeof value !== 'string') return false;
  const digest = s => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(value), digest(secret));
}
async function redis(command) {
  const response = await fetch(redisURL, {method:'POST', headers:{Authorization:'Bearer '+redisToken,'Content-Type':'application/json'},body:JSON.stringify(command)});
  if (!response.ok) throw Error('Storage unavailable');
  const body=await response.json(); if(body.error)throw Error('Storage error');
  return body.result;
}
function validate(book) {
  const date = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const label = x => typeof x==='string' && x.length>0 && x.length<150;
  const integer=Number.isSafeInteger;
  if(!book||!date(book.first)||!date(book.last)||book.first>book.last||book.last<baseline.last||!label(book.filename)||!integer(book.duplicates)||book.duplicates<0||!Array.isArray(book.result)||!book.result.length||book.result.length>100000)return false;
  let first=book.last,last=book.first;const seen=new Set();
  for(const row of book.result){
    if(!Array.isArray(row)||row.length!==7)return false;
    const [m,p,g,v,n,missing,d]=row;
    if(!date(d)||m!==d.slice(0,7)||!label(p)||!label(g)||!integer(v)||!integer(n)||n<1||!integer(missing)||missing<0||missing>n)return false;
    const k=JSON.stringify([d,p,g]);if(seen.has(k))return false;seen.add(k);
    if(d<first)first=d;if(d>last)last=d;
  }
  if(first!==book.first||last!==book.last)return false;
  if(book.dispatch!=null){const d=book.dispatch;
    if(!date(d.day)||!Array.isArray(d.list)||!Array.isArray(d.stated)||!d.list.every(r=>Array.isArray(r)&&r[0]===d.day&&label(r[1])&&integer(r[2])&&integer(r[3])))return false;
    if(d.list.reduce((a,r)=>a+r[2],0)!==d.stated[0]||d.list.reduce((a,r)=>a+r[3],0)!==d.stated[1])return false;
  }return true;
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method))return res.status(405).end();
  if(!process.env.DASHBOARD_PASSWORD)return res.status(503).json({error:'Set DASHBOARD_PASSWORD in Vercel and redeploy.'});
  if(!matches(req.headers.authorization,'Bearer '+process.env.DASHBOARD_PASSWORD))return res.status(401).json({error:'Enter the team password.'});
  try{
    if(req.method==='GET'){
      const stored=redisURL&&redisToken?await redis(['GET',key]):null;
      return res.status(200).json(stored?JSON.parse(stored):baseline);
    }
    if(!matches(req.headers['x-publisher-key'],process.env.PUBLISHER_KEY))return res.status(403).json({error:'Publisher key is missing or incorrect.'});
    if(!redisURL||!redisToken)return res.status(503).json({error:'Connect Upstash Redis to enable shared updates.'});
    const book=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!validate(book))return res.status(422).json({error:'Workbook dates or totals failed validation.'});
    const script="local old=redis.call('GET',KEYS[1]); if old and cjson.decode(old).last>ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]);return 1";
    const ok=await redis(['EVAL',script,1,key,book.last,JSON.stringify(book)]);
    if(!ok)return res.status(409).json({error:'The shared report already has a newer invoice date.'});
    return res.status(200).json({saved:true});
  }catch{return res.status(503).json({error:'Could not access shared storage. Retry after checking the Redis connection.'})}
};
