const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {publicRecords}=require('../utils/sheetRecords.cjs');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function normalized(values){
 if(!Array.isArray(values)||values.length!==789)throw Error('Expected the verified788-record collection; publication stopped');
 const result=values.map(r=>Array.from({length:31},(_,i)=>String(r[i]??'')));
 if(result[0][0]!=='Record ID'||result[0][1]!=='Publication status')throw Error('Unexpected identity/status columns');
 if(new Set(result.slice(1).map(r=>r[0])).size!==788||result.slice(1).some(r=>!r[0]))throw Error('Blank or duplicate record ID');
 return result;
}
function prepare(values,proposal){
 const before=normalized(values),expected=before.map(row=>row.slice());
 const targets=new Set(proposal.changes.map(c=>c.record_id));
 if(targets.size!==733||proposal.changes.some(c=>c.field!=='Publication status'||c.expected!=='Ready'||c.proposed!=='Published'))throw Error('Unexpected approved publication selection');
 if([...targets].some(id=>!before.slice(1).some(r=>r[0]===id)))throw Error('Approved publication ID missing');
 for(const row of expected.slice(1)){
  if(targets.has(row[0])){
   if(!['Ready','Published'].includes(row[1]))throw Error('Publication decision changed since approval; stopped');
   row[1]='Published';
  }else if(row[1]!=='Ready')throw Error('Unselected publication decision changed; stopped without overwriting');
 }
 if(publicRecords(expected).length!==733)throw Error('Public projection count mismatch');
 return {before,expected,clipboard:expected.slice(1).map(r=>r[1]).join('\n')};
}
function verify(values,expected){
 const actual=normalized(values);expected=normalized(expected);
 const mismatches=[];
 actual.forEach((row,i)=>row.forEach((value,j)=>{if(value!==expected[i][j])mismatches.push({row:i+1,column:j+1});}));
 if(mismatches.length)throw Error(`Publication readback differs in${mismatches.length}cells; first row${mismatches[0].row},column${mismatches[0].column}. Do not repeat the paste blindly.`);
 const publicCount=publicRecords(actual).length;
 if(publicCount!==733)throw Error('Expected733 Published records');
 return {records:788,published:733,ready:55,verified_cells:24428,mismatches:0,non_status_fields_preserved:true,sheet_modified_by_check:false};
}
function run(values,phase,root){
 const folder=path.join(root,'processing_runs/publication-proposal-v1'),proposalPath=path.join(folder,'proposal.json');
 const approval=JSON.parse(fs.readFileSync(path.join(root,'Admin/publication_authorization.json'),'utf8'));
 if(!approval.approved||approval.proposal_sha256!==digest(fs.readFileSync(proposalPath)))throw Error('Publication authorization mismatch');
 const proposal=JSON.parse(fs.readFileSync(proposalPath,'utf8'));
 if(phase==='prepare'){
  const result=prepare(values,proposal);
  for(const key of ['before','expected'])fs.writeFileSync(path.join(folder,key+'.json'),JSON.stringify(result[key]));
  fs.writeFileSync(path.join(folder,'publication-clipboard.tsv'),result.clipboard);
  fs.writeFileSync(path.join(folder,'preflight.json'),JSON.stringify({checked_at:new Date().toISOString(),published_after:733,ready_after:55,paste_range:'B2:B789',sheet_modified:false},null,2));
  console.log('Publication preflight passed:733 selected records;55 remainReady. Paste only B2:B789; all other columns are preserved.');
 }else{
  const report=verify(values,JSON.parse(fs.readFileSync(path.join(folder,'expected.json'),'utf8')));
  fs.writeFileSync(path.join(folder,'live-after.json'),JSON.stringify(normalized(values)));
  fs.writeFileSync(path.join(folder,'application-receipt.json'),JSON.stringify({...report,checked_at:new Date().toISOString()},null,2));
  console.log('Publication verified:733 Published,55 Ready;24428cells match; all non-status fields preserved.');
 }
}
module.exports={prepare,verify,run};
