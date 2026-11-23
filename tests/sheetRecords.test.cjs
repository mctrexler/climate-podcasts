const {test}=require('node:test');
const assert=require('node:assert/strict');
const {publicRecords,publicPodcastRecords,dateInterval,required,chronologicalCompare,episodeDateLabel}=require('../utils/sheetRecords.cjs');
const row=(changes={})=>required.map(h=>({...{'Record ID':'a','Publication status':'Published',Series:'Volts',Title:'Test','Publication date':'2024-02-29','Date precision':'day','Original URL':'https://example.org/episode',Tags:'Energy; Risk, Policy',Summary:'One authoritative summary','Content type':'podcast'},...changes})[h]);
test('Ready/Archived/blank never reach clients; private columns excluded',()=>{
 const values=[required.concat('Notes'),row().concat('private note'),row({'Record ID':'b','Publication status':'Ready'}),row({'Record ID':'c','Publication status':'Archived'}),row({'Record ID':'d','Publication status':''})];
 const records=publicRecords(values);assert.equal(records.length,1);assert.equal(JSON.stringify(records).includes('private'),false);assert.deepEqual(records[0].tags,['Energy','Risk','Policy']);
});
test('podcast feed hides published articles without changing editorial publication or other recording types',()=>{
 const values=[required,row(),row({'Record ID':'article','Content type':' Article '}),row({'Record ID':'video','Content type':'video'}),row({'Record ID':'uncertain','Content type':'uncertain'}),row({'Record ID':'hidden','Publication status':'Ready'})];
 assert.equal(publicRecords(values).length,4);
 assert.deepEqual(publicPodcastRecords(values).map(r=>r.id),['a','video','uncertain']);
 assert.equal(values[2][required.indexOf('Publication status')],'Published');
 const invalidArticle=[required,row(),row({'Record ID':'invalid-article','Content type':'article','Publication date':'bad-date','Original URL':'bad-url',Summary:''})];
 assert.equal(publicPodcastRecords(invalidArticle).length,1);
});
test('schema and duplicate IDs fail closed',()=>{assert.throws(()=>publicRecords([['Title'],['x']]));assert.throws(()=>publicRecords([required,row(),row()]));});
test('invalid calendar dates and URL schemes rejected',()=>{assert.equal(dateInterval('2025-02-29','day'),null);assert.equal(dateInterval('2024-13','month'),null);assert.throws(()=>publicRecords([required,row({'Original URL':'javascript:alert(1)'})]));});
test('month/year precision and unknown dates preserved',()=>{
 assert.equal(new Date(dateInterval('2024-02','month').end).getUTCDate(),29);assert.equal(new Date(dateInterval('2024','year').end).getUTCMonth(),11);assert.equal(dateInterval('2024-02','day'),null);
 assert.equal(publicRecords([required,row({'Publication date':'','Date precision':'unknown'})])[0].date,'');
});
test('chronology switches direction and keeps unknown dates last, even before 1970',()=>{
 const records=[{id:'unknown',date:'',date_precision:'unknown'}, {id:'recent',date:'2025-02',date_precision:'month'}, {id:'early',date:'1960',date_precision:'year'}].map(r=>({...r,series:'Series',title:r.id}));
 assert.deepEqual([...records].sort((a,b)=>chronologicalCompare(a,b)).map(r=>r.id),['recent','early','unknown']);
 assert.deepEqual([...records].sort((a,b)=>chronologicalCompare(a,b,'oldest')).map(r=>r.id),['early','recent','unknown']);
});
test('episode date labels show month/year without inventing missing precision',()=>{
 assert.equal(episodeDateLabel('2025-07-01','day'),'July 2025');
 assert.equal(episodeDateLabel('2025-07','month'),'July 2025');
 assert.equal(episodeDateLabel('2025','year'),'2025 (month unknown)');
 assert.equal(episodeDateLabel('','unknown'),'Episode date not yet verified');
 assert.equal(episodeDateLabel('2025-02-30','day'),'Episode date not yet verified');
});
