const crypto = require('node:crypto');
const {redis, save} = require('./store');
const prefix = 'rakshith:onedrive:';
const login = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/';
const scope = 'offline_access https://graph.microsoft.com/Files.ReadWrite';
function callback() {
  const site = new URL(process.env.SITE_URL);
  if(site.protocol !== 'https:') throw Error('Configure HTTPS site URL');
  return site.origin + '/api/onedrive';
}
async function token(fields) {
  const body = new URLSearchParams({...fields,client_id:process.env.MS_CLIENT_ID,client_secret:process.env.MS_CLIENT_SECRET});
  const r = await fetch(login+'token',{method:'POST',body});
  if(!r.ok) throw Error('Microsoft authorization failed. Reconnect OneDrive.');
  return r.json();
}
function cipherKey(){return crypto.createHash('sha256').update(process.env.MS_CLIENT_SECRET).digest()}
async function remember(value){
  const iv=crypto.randomBytes(12), c=crypto.createCipheriv('aes-256-gcm',cipherKey(),iv);
  const data=Buffer.concat([c.update(value,'utf8'),c.final()]);
  await redis(['SET',prefix+'token',Buffer.concat([iv,c.getAuthTag(),data]).toString('base64')]);
}
async function refresh(){
  const id=crypto.randomUUID();
  if(!await redis(['SET',prefix+'lock',id,'NX','EX',100]))throw Error('Another refresh is running.');
  try{
    const sealed=await redis(['GET',prefix+'token']);
    if(!sealed)throw Error('Connect OneDrive first.');
    const buf=Buffer.from(sealed,'base64'),dec=crypto.createDecipheriv('aes-256-gcm',cipherKey(),buf.subarray(0,12));
    dec.setAuthTag(buf.subarray(12,28));
    const grant=await token({grant_type:'refresh_token',refresh_token:Buffer.concat([dec.update(buf.subarray(28)),dec.final()]).toString()});
    if(grant.refresh_token)await remember(grant.refresh_token);
    const url=process.env.ONEDRIVE_SHARE_URL?.trim();
    if(!url)throw Error('Set ONEDRIVE_SHARE_URL in Vercel.');
    const item='https://graph.microsoft.com/v1.0/shares/u!'+Buffer.from(url).toString('base64url')+'/driveItem';
    const headers={Authorization:'Bearer '+grant.access_token};
    const meta=await fetch(item+'?$select=name,file,id,parentReference',{headers});
    if(!meta.ok)throw Error('Microsoft could not open the shared workbook. Check the link and account.');
    const file=await meta.json();
    if(!file.file||!file.name?.toLowerCase().endsWith('.xlsx'))throw Error('The link must point to an Excel workbook.');
    const download=await fetch('https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(file.parentReference.driveId)+'/items/'+encodeURIComponent(file.id)+'/content',{headers});
    if(!download.ok)throw Error('OneDrive workbook download failed.');
    const bytes=await download.arrayBuffer();
    const parser=require('../public/workbook');
    const book=await parser({name:file.name,arrayBuffer:async()=>bytes},require('@xmldom/xmldom').DOMParser);
    const result=await save(book);
    if(!result)throw Error('The workbook is older than the published report.');
    return {latest:book.last,unchanged:result===2};
  } finally {await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end",1,prefix+'lock',id])}
}
module.exports={login,scope,callback,token,remember,refresh,prefix};
