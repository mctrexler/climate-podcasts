// Read-only comparison of staged updates with fresh live Sheet data.
const fs=require('node:fs');
const path=require('node:path');
function inspectProposal(values,proposal,after=false){
 const [headers=[],...rawRows]=values||[],records=proposal.records;
 if(!Array.isArray(records)||!records.length)throw Error('Empty summary proposal');
 const wanted=Object.keys(records[0].expected);
 if(wanted.some(h=>headers.filter(x=>x===h).length!==1))throw Error('Missing or duplicate proposal headers');
 const rows=rawRows.filter(r=>r.some(c=>String(c).trim())),seen=new Map();
 const idIndex=headers.indexOf('Record ID');
 let duplicates=0,missing=0,mismatchedRecords=0,mismatchedCells=0;
 const norm=v=>String(v??'').replace(/\r\n/g,'\n');
 for(const row of rows){const id=norm(row[idIndex]);if(!id||seen.has(id))duplicates++;seen.set(id,row);}
 for(const record of records){
  const row=seen.get(record.record_id);
  if(!row){missing++;continue;}
  const expected=after?{...record.expected,...record.updates}:record.expected;
  let different=false;
  for(const [field,value] of Object.entries(expected)){
   if(norm(row[headers.indexOf(field)])!==norm(value)){mismatchedCells++;different=true;}
  }
  if(different)mismatchedRecords++;
 }
 return {checked_at:new Date().toISOString(),phase:after?'after_update':'before_update',
  expected_records:records.length,sheet_records:rows.length,duplicate_or_blank_ids:duplicates,
  missing_records:missing,mismatched_records:mismatchedRecords,mismatched_cells:mismatchedCells,
  verified:!duplicates&&!missing&&!mismatchedCells,sheet_modified:false};
}
function verifySummaryProposal(values,after=false){
 const root=path.resolve(__dirname,'../..'),folder=path.join(root,'processing_runs/summary-update-v3');
 const proposal=JSON.parse(fs.readFileSync(path.join(folder,'summary-update-proposal.json'),'utf8'));
 const report=inspectProposal(values,proposal,after);
 fs.writeFileSync(path.join(folder,`sheet-${report.phase}-${Date.now()}.json`),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(report.verified?(after?'SUMMARY UPDATE VERIFIED; all unchanged fields also match.':'SUMMARY PROPOSAL PREFLIGHT PASSED; no changes made.'):'SUMMARY COMPARISON FAILED: preserve live editorial changes; do not overwrite or reimport.');
 console.log(JSON.stringify(report,null,2));
 return report;
}
module.exports={inspectProposal,verifySummaryProposal};
