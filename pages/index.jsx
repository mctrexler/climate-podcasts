import React, {useEffect, useMemo, useRef, useState} from 'react';
import {dateInterval, chronologicalCompare, episodeDateLabel} from '../utils/sheetRecords.cjs';
const unique = values => [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
export default function PodcastEpisodes(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [series,setSeries]=useState([]),[tags,setTags]=useState([]),[search,setSearch]=useState(''),[period,setPeriod]=useState('all'),[max,setMax]=useState(200);
 const [order,setOrder]=useState('newest');
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){try{
   const response=await fetch('/api/episodes',{signal:controller.signal,cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Collection unavailable');
   if(!Array.isArray(data.episodes))throw Error('Unexpected collection response');setRows(data.episodes);
  }catch(e){if(e.name!=='AbortError')setError(e.message);}finally{if(!controller.signal.aborted)setLoading(false);}}
  load();return()=>controller.abort();
 },[]);
 const filtered=useMemo(()=>{
  const now=Date.now(),cutoff=now-Number(period)*86400000,q=search.trim().toLowerCase();
  return rows.filter(r=>{
   if(series.length&&!series.includes(r.series))return false;
   if(tags.length&&!r.tags.some(t=>tags.includes(t)))return false;
   if(period!=='all'){const interval=dateInterval(r.date,r.date_precision);if(!interval||interval.end<cutoff||interval.start>now)return false;}
   return !q||[r.title,r.series,r.summary,...r.tags].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>chronologicalCompare(a,b,order));
 },[rows,series,tags,search,period,order]);
 const limited=max===-1?filtered:filtered.slice(0,max);
 return <main className="p-6 space-y-6 explorer">
  <header className="collection-header"><p className="eyebrow">The Climatographers</p><h1>Climate Podcast Explorer</h1><p>Discover conversations about climate change. Explore a series or topic, search the collection, and read episode summaries.</p></header>
  {error&&<p role="alert" className="feed-error">{error}</p>}
  <section aria-label="Collection filters" className="grid gap-4 md:grid-cols-3">
   <div><h2 className="filter-label">Podcast series</h2><MultiSelect options={unique(rows.map(r=>r.series))} selected={series} onChange={setSeries} placeholder="All series" /></div>
   <div><h2 className="filter-label">Topics / tags</h2><MultiSelect options={unique(rows.flatMap(r=>r.tags))} selected={tags} onChange={setTags} placeholder="All topics" /></div>
   <div className="search-controls"><label htmlFor="search">Search collection</label><input id="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search titles, summaries, series..." />
   <label htmlFor="period">Date window</label><select id="period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">All time</option>{[7,30,90,365].map(n=><option key={n} value={n}>Last {n} days</option>)}</select>
   <label htmlFor="order">Chronological order</label><select id="order" value={order} onChange={e=>setOrder(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
   <label htmlFor="max">Maximum results</label><select id="max" value={max} onChange={e=>setMax(Number(e.target.value))}>{[100,200,500].map(n=><option key={n} value={n}>{n}</option>)}<option value={-1}>All</option></select>
   <button onClick={()=>{setSeries([]);setTags([]);setSearch('');setPeriod('all');setOrder('newest');setMax(200);}}>Reset filters</button></div>
  </section>
  <p role="status">{loading?'Loading episodes...':`Showing ${limited.length} of ${filtered.length} matching records (${rows.length} published).`}</p>
  {!loading&&!error&&!limited.length&&<p>{rows.length?'No records match these filters.':'No episodes have been published yet.'}</p>}
  <section aria-label="Episodes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{limited.map(r=><EpisodeCard key={r.id} row={r}/>)}</section>
 </main>;
}
function EpisodeCard({row}){
 const ref=useRef(null),trigger=useRef(null),titleId=React.useId();
 function open(){ref.current.showModal();}
 function close(){ref.current.close();}
 return <article className="episode-card">
  <p className="episode-series">{row.series||row.content_type||'Climate collection'}</p>
  <h2>{row.title}</h2>
  <p className="episode-date">{episodeDateLabel(row.date,row.date_precision)}</p>
  <p className="summary-preview">{row.summary.slice(0,220)}{row.summary.length>220?'…':''}</p>
  <div className="tag-list">{row.tags.map(t=><span key={t}>{t}</span>)}</div>
  <button ref={trigger} className="read-summary" aria-haspopup="dialog" onClick={open}>Read summary<span className="sr-only">: {row.title}</span></button>
  <dialog ref={ref} aria-labelledby={titleId} className="summary-dialog" onClose={()=>trigger.current?.focus()}>
   <button className="close-dialog" autoFocus onClick={close}>Close</button><p className="episode-series">{row.series}</p><h2 id={titleId}>{row.title}</h2>
   <p className="episode-date">{episodeDateLabel(row.date,row.date_precision)}</p><div className="full-summary">{row.summary}</div>
  </dialog>
 </article>;
}
function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tempSelected, setTempSelected] = useState([]);
  const rootRef = useRef(null);

  // Open menu: seed temp state from controlled value
  function openMenu() {
    setTempSelected(selected);
    setOpen(true);
  }

  // Close on outside click & Escape
  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function toggle(item) {
    const set = new Set(tempSelected);
    set.has(item) ? set.delete(item) : set.add(item);
    setTempSelected(Array.from(set));
  }

  function applyChanges(closeAfter = false) {
    onChange(tempSelected);
    if (closeAfter) setOpen(false);
  }

  function clearAll(closeAfter = false) {
    setTempSelected([]);
    onChange([]);
    if (closeAfter) setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="w-full border rounded px-3 py-2 text-left text-sm flex justify-between"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-expanded={open}
      >
        <span>
          {selected.length ? `${selected.length} selected` : <span className="text-gray-400">{placeholder}</span>}
        </span>
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-full border rounded bg-white shadow p-2">
          <div className="flex items-center gap-2 mb-2">
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button className="text-xs px-2 py-1 border rounded" onClick={() => clearAll(false)}>
              Clear
            </button>
          </div>

          <div className="max-h-48 overflow-auto">
            {filtered.length ? (
              filtered.map((opt) => {
                const isSel = tempSelected.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={isSel} onChange={() => toggle(opt)} />
                    <span>{opt}</span>
                  </label>
                );
              })
            ) : (
              <div className="text-xs text-gray-500 px-2 py-1">No matches</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button className="text-xs px-2 py-1 border rounded" onClick={() => applyChanges(false)}>
              Apply
            </button>
            <button className="text-xs px-2 py-1 border rounded bg-gray-50" onClick={() => applyChanges(true)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
