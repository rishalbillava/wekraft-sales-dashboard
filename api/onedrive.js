const {randomBytes,createHash}=require('node:crypto');
const {matches,redis}=require('../lib/store');
const {login,scope,callback,token,remember,prefix}=require('../lib/onedrive');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  try{
    if(req.method==='POST'){
      if(!matches(req.headers['x-publisher-key'],process.env.PUBLISHER_KEY))return res.status(403).json({error:'Enter the publisher key.'});
      if(!process.env.MS_CLIENT_ID||!process.env.MS_CLIENT_SECRET||!process.env.ONEDRIVE_SHARE_URL)throw Error();
      const state=randomBytes(32).toString('hex'), verifier=randomBytes(48).toString('base64url');
      const params=new URLSearchParams({client_id:process.env.MS_CLIENT_ID,response_type:'code',redirect_uri:callback(),scope,state,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')});
      await redis(['SET',prefix+'state:'+state,verifier,'EX',600]);
      res.setHeader('Set-Cookie','onedrive_state='+state+'; Path=/api/onedrive; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
      return res.json({url:login+'authorize?'+params});
    }
    if(req.method!=='GET')return res.status(405).end();
    const {state,code}=req.query;
    const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)onedrive_state=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(!matches(state,cookie)||typeof code!=='string')return res.status(400).send('Connection was not completed. Return to the dashboard and reconnect.');
    const verifier=await redis(['GETDEL',prefix+'state:'+state]);
    if(!verifier)return res.status(400).send('Connection expired. Return to the dashboard and reconnect.');
    const grant=await token({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:callback()});
    if(!grant.refresh_token)throw Error();
    await remember(grant.refresh_token);
    res.setHeader('Set-Cookie','onedrive_state=; Path=/api/onedrive; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res.redirect(303,'/?onedrive=connected');
  }catch{return res.status(503).json({error:'OneDrive connection failed. Check Microsoft app settings and Redis.'})}
};
