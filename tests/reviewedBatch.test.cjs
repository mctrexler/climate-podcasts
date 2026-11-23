const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectReviewedBatch}=require('../scripts/reviewed-batch.cjs');
const a={'Record ID':'a',Title:'Existing',Series:'Series',Summary:'Old','Publication status':'Ready',Notes:'Keep','Source IDs':''};
const b={...a,'Record ID':'b',Title:'Untouched'};
const c={...a,'Record ID':'c',Title:'New episode',Summary:'New','Source IDs':'source-c'};
const headers=Object.keys(a),values=rows=>[headers,...rows.map(r=>headers.map(h=>r[h]))];
const legacy={records:[a,b].map(expected=>({record_id:expected['Record ID'],expected}))};
const batch={version:'test',updates:[{record_id:'a',updates:{Summary:'Full source'}}],appends:[c]};
test('reviewed batch protects all old editorial values and rejects possible duplicate episodes',()=>{
 assert.equal(inspectReviewedBatch(values([a,b]),batch,legacy).verified,true);
 assert.equal(inspectReviewedBatch(values([a,{...b,Notes:'Later edit'}]),batch,legacy).verified,false);
 assert.equal(inspectReviewedBatch(values([a,b,{...c,'Record ID':'other'}]),batch,legacy).verified,false);
});
test('readback verifies the targeted update and append while preserving exclusions and other rows',()=>{
 const updated={...a,Summary:'Full source'};
 assert.equal(inspectReviewedBatch(values([updated,b,c]),batch,legacy,true).verified,true);
 assert.equal(inspectReviewedBatch(values([updated,b]),batch,legacy,true).verified,false);
 assert.equal(inspectReviewedBatch(values([updated,{...b,Summary:'Overwritten'},c]),batch,legacy,true).verified,false);
 assert.equal(inspectReviewedBatch(values([{...updated,'Publication status':'Published'},b,c]),batch,legacy,true).verified,false);
});
