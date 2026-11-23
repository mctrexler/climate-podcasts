const required=['Record ID','Publication status','Series','Title','Publication date','Date precision','Original URL','Tags','Summary','Content type'];
function dateInterval(value,precision){
 const s=String(value||'').trim();
 const inferred=/^\d{4}$/.test(s)?'year':/^\d{4}-\d{2}$/.test(s)?'month':/^\d{4}-\d{2}-\d{2}$/.test(s)?'day':'';
 if(!inferred||(precision&&precision!==inferred))return null;
 const [y,m=1,d=1]=s.split('-').map(Number);
 if(y<1000||m<1||m>12||d<1||d>31)return null;
 const start=Date.UTC(y,m-1,d),check=new Date(start);
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;
 const end=inferred==='year'?Date.UTC(y+1,0,1)-1:inferred==='month'?Date.UTC(y,m,1)-1:start+86400000-1;
 return {start,end};
}
function publicRecords(values){
 const [headers,...rows]=values||[];
 if(!headers||required.some(h=>headers.filter(x=>x===h).length!==1))throw Error('Unexpected Episodes schema');
 const field=(r,h)=>String(r[headers.indexOf(h)]??'').trim(),seen=new Set();
 return rows.flatMap(r=>{
  const id=field(r,'Record ID');if(id){if(seen.has(id))throw Error('Duplicate Record ID');seen.add(id);}
  if(field(r,'Publication status').toLowerCase()!=='published')return [];
  const title=field(r,'Title'),summary=field(r,'Summary');if(!id||!title||!summary)throw Error('Incomplete Published record');
  let url='';const rawURL=field(r,'Original URL');
  if(rawURL){try{const u=new URL(rawURL);if(!['https:','http:'].includes(u.protocol))throw Error();url=u.href;}catch{throw Error('Invalid Published URL');}}
  const date=field(r,'Publication date'),precision=field(r,'Date precision').toLowerCase();
  if(date&&!dateInterval(date,precision))throw Error('Invalid publication date');
  return [{id,series:field(r,'Series'),title,date,date_precision:precision,url,
   tags:[...new Set(field(r,'Tags').split(/[;,]/).map(t=>t.trim()).filter(Boolean))],summary,content_type:field(r,'Content type')}];
 });
}
function chronologicalCompare(a,b,order='newest'){
 const left=dateInterval(a.date,a.date_precision),right=dateInterval(b.date,b.date_precision);
 // Unknown dates belong at the end in either direction, including pre-1970 dates.
 if(!left&&right)return 1;
 if(left&&!right)return -1;
 const difference=left&&right?(left.start-right.start)*(order==='oldest'?1:-1):0;
 return difference||a.series.localeCompare(b.series)||a.title.localeCompare(b.title);
}
function episodeDateLabel(value,precision){
 const interval=dateInterval(value,precision);
 if(!interval)return 'Episode date not yet verified';
 const date=new Date(interval.start);
 if(String(value).trim().length===4)return `${date.getUTCFullYear()} (month unknown)`;
 return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
}
module.exports={publicRecords,dateInterval,required,chronologicalCompare,episodeDateLabel};
