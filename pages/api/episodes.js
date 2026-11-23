import {createSign} from 'node:crypto';
import {publicPodcastRecords} from '../../utils/sheetRecords.cjs';
let tokenCache;
async function token(){
 if(tokenCache?.expires>Date.now())return tokenCache.token;
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!email||!key)throw Error('Missing configuration');
 const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signer.sign(key,'base64url')}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Authentication failed');const result=await response.json();if(!result.access_token)throw Error('Missing access token');
 tokenCache={token:result.access_token,expires:Date.now()+(result.expires_in-120)*1000};return tokenCache.token;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 try{
  const id=process.env.GOOGLE_SHEETS_SPREADSHEET_ID;if(!id)throw Error('Missing configuration');
  const access=await token();
  const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent("'Episodes'!A1:W10000")}?valueRenderOption=FORMATTED_VALUE`,{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Sheet unavailable');const data=await response.json();
  if(data.values?.length>=10000)throw Error('Sheet range capacity exceeded');
  return res.status(200).json({episodes:publicPodcastRecords(data.values)});
 }catch{return res.status(503).json({error:'The collection is temporarily unavailable. Please try again shortly.'});}
}
