// Three-record review batch: one refresh, two appends. Read-only verification.
const fs=require('node:fs');
const path=require('node:path');
const {inspectProposal}=require('./summary-proposal.cjs');
const norm=v=>String(v??'').replace(/\r\n/g,'\n');
const identity=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
function inspectReviewedBatch(values,batch,legacy,after=false){
 const changed=new Map(batch.updates.map(r=>[r.record_id,r]));
 const records=legacy.records.map(r=>({record_id:r.record_id,expected:r.expected,updates:after?(changed.get(r.record_id)?.updates||{}):{}}));
 if(after)records.push(...batch.appends.map(r=>({record_id:r['Record ID'],expected:r,updates:{}})));
 const report=inspectProposal(values,{records},after);
 const [headers,...rows]=values;
 const get=(row,name)=>norm(row[headers.indexOf(name)]);
 let duplicateEpisodeCandidates=0,unexpectedExistingAppendIds=0;
 if(!after){
  for(const candidate of batch.appends){
   const sourceIds=new Set(candidate['Source IDs'].split(';').map(s=>s.trim()).filter(Boolean));
   for(const row of rows){
    if(get(row,'Record ID')===candidate['Record ID']){unexpectedExistingAppendIds++;continue;}
    const sameTitle=identity(get(row,'Title'))===identity(candidate.Title)&&identity(get(row,'Series'))===identity(candidate.Series);
    const linkedSource=get(row,'Source IDs').split(';').some(s=>sourceIds.has(s.trim()));
    if(sameTitle||linkedSource)duplicateEpisodeCandidates++;
   }
  }
 }
 return {...report,batch_version:batch.version,legacy_records_protected:legacy.records.length,
  targeted_existing_updates:batch.updates.length,new_records:batch.appends.length,
  duplicate_episode_candidates:duplicateEpisodeCandidates,unexpected_existing_append_ids:unexpectedExistingAppendIds,
  verified:report.verified&&!duplicateEpisodeCandidates&&!unexpectedExistingAppendIds};
}
function verifyReviewedBatch(values,after=false){
 const root=path.resolve(__dirname,'../..'),folder=path.join(root,'processing_runs/sheet-reviewed-batch-v1');
 const batch=JSON.parse(fs.readFileSync(path.join(folder,'batch.json'),'utf8'));
 const legacy=JSON.parse(fs.readFileSync(path.join(root,'processing_runs/summary-update-v3/summary-update-proposal.json'),'utf8'));
 const report=inspectReviewedBatch(values,batch,legacy,after);
 fs.writeFileSync(path.join(folder,`sheet-${report.phase}-${Date.now()}.json`),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(report.verified?(after?'REVIEWED BATCH VERIFIED: update, appends, and untouched legacy fields match.':'REVIEWED BATCH PREFLIGHT PASSED; no changes made.'):'REVIEWED BATCH NOT VERIFIED: preserve live values; inspect differences before any edits.');
 console.log(JSON.stringify(report,null,2));return report;
}
module.exports={inspectReviewedBatch,verifyReviewedBatch};
