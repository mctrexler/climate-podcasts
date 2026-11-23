const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectProposal}=require('../scripts/summary-proposal.cjs');
const expected={'Record ID':'a',Summary:'Original',Notes:'Keep note','Publication status':'Ready'};
const proposal={records:[{record_id:'a',expected,updates:{Summary:'Merged'}}]};
const headers=Object.keys(expected);
const sheet=(changes={})=>[headers,headers.map(h=>({...expected,...changes})[h])];
test('summary preflight detects later editorial changes and publication decisions',()=>{
 assert.equal(inspectProposal(sheet(),proposal).verified,true);
 assert.equal(inspectProposal(sheet({Notes:'New editorial note'}),proposal).verified,false);
 assert.equal(inspectProposal(sheet({'Publication status':'Published'}),proposal).verified,false);
});
test('readback requires exact updated text while preserving other fields',()=>{
 assert.equal(inspectProposal(sheet(),proposal,true).verified,false);
 assert.equal(inspectProposal(sheet({Summary:'Merged'}),proposal,true).verified,true);
 assert.equal(inspectProposal(sheet({Summary:'Merged',Notes:''}),proposal,true).verified,false);
});
test('identity checks reject duplicates and missing records but accept reordering',()=>{
 const values=sheet();
 assert.equal(inspectProposal([...values,values[1]],proposal).verified,false);
 assert.equal(inspectProposal([headers],proposal).verified,false);
 const reverse=headers.toReversed();
 assert.equal(inspectProposal([reverse,reverse.map(h=>expected[h])],proposal).verified,true);
});
