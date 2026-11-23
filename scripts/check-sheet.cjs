// Local diagnostics: never prints keys, tokens, row contents or Google response bodies.
const path=require('node:path');
const {createSign,createPrivateKey}=require('node:crypto');
require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'));
const {required}=require('../utils/sheetRecords.cjs');
async function main(){
 process.exitCode=1; // Every early failure must block dependent import preparation.
 const id=process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
 const key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!id||!email||!key){console.log('FAIL: Missing local connection settings.');return;}
 try{createPrivateKey(key);}catch{console.log('FAIL: Private key format is invalid.');return;}
 console.log('Local settings and private key format: OK');
 const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signer.sign(key,'base64url')}),signal:AbortSignal.timeout(15000)});
 if(!auth.ok){console.log('FAIL: Google authentication returned HTTP '+auth.status);return;}
 const token=await auth.json();console.log('Google authentication: OK');
 const base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id);
 const options={headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)};
 const metadata=await fetch(base+'?fields=sheets.properties.title',options);
 if(!metadata.ok){console.log('FAIL: Spreadsheet access returned HTTP '+metadata.status+' (403: check API enabled and Viewer sharing; 404: check spreadsheet ID/access).');return;}
 const info=await metadata.json();
 if(!info.sheets?.some(s=>s.properties.title==='Episodes')){console.log('FAIL: No tab named exactly Episodes. Rename the intended tab.');return;}
 const response=await fetch(base+'/values/'+encodeURIComponent("'Episodes'!A1:AE10000")+'?valueRenderOption=FORMATTED_VALUE',{headers:options.headers,signal:AbortSignal.timeout(15000)});
 if(!response.ok){console.log('FAIL: Episodes read returned HTTP '+response.status);return;}
 const data=await response.json(),headers=data.values?.[0]||[];
 const missing=required.filter(h=>!headers.includes(h));
 if(missing.length){console.log('FAIL: Missing exact column headers: '+missing.join(', '));console.log('Cells found in first row: '+headers.length+' (headers must occupy separate columns).');return;}
 console.log('Spreadsheet access, Episodes tab and required headers: OK');
 console.log('Data rows: '+Math.max(0,(data.values?.length||0)-1));
 if(process.argv.includes('--prepare-publication')||process.argv.includes('--verify-publication')){
  const phase=process.argv.includes('--verify-publication')?'verify':'prepare';
  require('./publication.cjs').run(data.values,phase,path.resolve(__dirname,'../..'));
 }
 if(process.argv.includes('--prepare-editorial-import')||process.argv.includes('--verify-editorial-import')){
  const fs=require('node:fs'),Papa=require('papaparse'),{spawnSync}=require('node:child_process');
  const root=path.resolve(__dirname,'../..'),folder=path.join(root,'processing_runs/editorial-import-v1');
  fs.mkdirSync(folder,{recursive:true});
  const padded=(data.values||[]).map(row=>Array.from({length:31},(_,i)=>String(row[i]??'')));
  const exportPath=path.join(folder,'live-current.csv');
  fs.writeFileSync(exportPath,Papa.unparse(padded));
  const phase=process.argv.includes('--verify-editorial-import')?'verify':'prepare';
  const result=spawnSync(path.join(root,'.venv-summary/Scripts/python.exe'),[
   path.join(root,'Admin/api_summaries/append_collection_004.py'),phase,exportPath,'processing_runs/editorial-import-v1'
  ],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.status!==0){console.log('FAIL: Editorial import '+phase+' check stopped; no Sheet changes made by this command.');process.exitCode=1;return;}
  console.log('Live Sheet '+phase+' check passed. This command only reads the Sheet.');
 }
 if(process.argv.includes('--preflight-reviewed-batch')||process.argv.includes('--verify-reviewed-batch')){
  const {verifyReviewedBatch}=require('./reviewed-batch.cjs');
  const report=verifyReviewedBatch(data.values,process.argv.includes('--verify-reviewed-batch'));
  if(!report.verified){process.exitCode=1;return;}
 }
 if(process.argv.includes('--verify-summary-proposal')||process.argv.includes('--verify-summary-update')){
  const {verifySummaryProposal}=require('./summary-proposal.cjs');
  const report=verifySummaryProposal(data.values,process.argv.includes('--verify-summary-update'));
  if(!report.verified){process.exitCode=1;return;}
 }
 if(process.argv.includes('--verify-import')){
  const fs=require('node:fs'),Papa=require('papaparse');
  const root=path.resolve(__dirname,'../..');
  const parsed=Papa.parse(fs.readFileSync(path.join(root,'Admin/Episodes_Legacy_Review_Proposal.csv'),'utf8'),{header:true,skipEmptyLines:true});
  if(parsed.errors.length)throw Error('Proposal parse failed');
  const expected=parsed.data,rows=(data.values||[]).slice(1).filter(r=>r.some(c=>String(c).trim()));
  const idColumn=headers.indexOf('Record ID'),seen=new Map();let duplicates=0;
  for(const row of rows){const id=String(row[idColumn]||'');if(seen.has(id))duplicates++;seen.set(id,row);}
  let mismatches=0,missingRecords=0;
  const norm=v=>String(v??'').replace(/\r\n/g,'\n');
  for(const record of expected){const row=seen.get(record['Record ID']);if(!row){missingRecords++;continue;}
   for(const column of parsed.meta.fields){const i=headers.indexOf(column);if(i<0||norm(row[i])!==norm(record[column]))mismatches++;}
  }
  const passed=expected.length===rows.length&&!duplicates&&!mismatches&&!missingRecords;
  const report={checked_at:new Date().toISOString(),expected_records:expected.length,sheet_records:rows.length,duplicate_ids:duplicates,missing_records:missingRecords,mismatched_cells:mismatches,live_sheet_readback_verified:passed,publication_status_counts:rows.reduce((counts,r)=>{const status=String(r[headers.indexOf('Publication status')]||'blank');counts[status]=(counts[status]||0)+1;return counts;},{}),sheet_modified:false};
  const folder=path.join(root,'processing_runs/app-migration-20261117');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'sheet-readback-'+Date.now()+'.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(passed?'IMPORT VERIFIED: All records and imported fields match the proposal.':'IMPORT NOT VERIFIED: Differences found; do not reimport or overwrite editorial changes.');
  console.log(JSON.stringify(report,null,2));
 }
 console.log('Connection check passed.');
 process.exitCode=0;
}
main().catch(error=>{
 process.exitCode=1;
 const code=String(error.cause?.code||error.code||error.name||'UNKNOWN');
 console.log('FAIL: Network/connection check: '+(/^[A-Z_a-z0-9]+$/.test(code)?code:'UNKNOWN'));
});
