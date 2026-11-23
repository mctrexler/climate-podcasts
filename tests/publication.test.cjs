const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare,verify}=require('../scripts/publication.cjs');
const headers=['Record ID','Publication status','Series','Title','Publication date','Date precision','Original URL','Tags','Summary','Content type',...Array.from({length:21},(_,i)=>'Private'+i)];
function fixture(){return [headers,...Array.from({length:788},(_,i)=>['ep-'+i,'Ready','Series','Title '+i,'2025-01','month','','Policy','Substantive summary','podcast','Private notes '+i])];}
function proposal(){return {changes:Array.from({length:733},(_,i)=>({record_id:'ep-'+i,field:'Publication status',expected:'Ready',proposed:'Published'}))};}
test('publication changes only733approved status cells and preserves55hidden rows',()=>{
 const input=fixture(),result=prepare(input,proposal());
 assert.equal(result.clipboard.split('\n').length,788);
 assert.equal(result.expected.filter(r=>r[1]==='Published').length,733);
 for(let i=0;i<input.length;i++)for(let j=0;j<31;j++)if(j!==1)assert.equal(result.expected[i][j],result.before[i][j]);
 assert.equal(input[1][1],'Ready');
 assert.equal(verify(result.expected,result.expected).published,733);
});
test('record IDs, not frozen row positions, select publication after sorting',()=>{
 const input=fixture();input.splice(1,788,...input.slice(1).reverse());
 const result=prepare(input,proposal());assert.equal(result.expected[1][1],'Ready');assert.equal(result.expected.at(-1)[1],'Published');
});
test('changed editorial publication decisions stop preparation',()=>{
 const input=fixture();input[1][1]='Archived';assert.throws(()=>prepare(input,proposal()),/decision changed/);
 const second=fixture();second.at(-1)[1]='Published';assert.throws(()=>prepare(second,proposal()),/Unselected/);
});
test('readback rejects unexpected changes to notes or summaries',()=>{
 const result=prepare(fixture(),proposal()),changed=structuredClone(result.expected);
 changed[1][10]='Lost notes';assert.throws(()=>verify(changed,result.expected),/differs/);
 changed[1][10]=result.expected[1][10];changed[1][8]='Different summary';assert.throws(()=>verify(changed,result.expected),/differs/);
});
test('duplicate IDs and incomplete publication selections cannot proceed',()=>{
 const input=fixture();input[2][0]=input[1][0];assert.throws(()=>prepare(input,proposal()),/duplicate/);
 const p=proposal();p.changes.pop();assert.throws(()=>prepare(fixture(),p),/selection/);
});
