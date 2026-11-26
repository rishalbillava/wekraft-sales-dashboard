const {matches,redis}=require('../lib/store');
const {refresh}=require('../lib/onedrive');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const cron=req.method==='GET'&&process.env.CRON_SECRET&&matches(req.headers.authorization,'Bearer '+process.env.CRON_SECRET);
  const manual=req.method==='POST'&&matches(req.headers['x-publisher-key'],process.env.PUBLISHER_KEY);
  if(!cron&&!manual)return res.status(403).json({error:'Refresh requires publisher authorization.'});
  const statusKey='rakshith:onedrive:last-check';
  try{
    const result=await refresh();
    await redis(['SET',statusKey,JSON.stringify({ok:true,at:new Date().toISOString()})]);
    return res.json(result)
  }
  catch(e){if(e.message!=='Another refresh is running.')await redis(['SET',statusKey,JSON.stringify({ok:false,at:new Date().toISOString()})]).catch(()=>{});console.error('OneDrive refresh failed:',e.name);return res.status(503).json({error:/^(Another refresh|Connect OneDrive|Microsoft |OneDrive workbook|Set ONEDRIVE|The workbook is older)/.test(e.message)?e.message:'Refresh failed. Check workbook validation, Redis and Microsoft configuration. The previous report is retained.'})}
};
