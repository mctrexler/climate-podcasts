import React, { useEffect, useMemo, useState, useRef } from "react";
import Papa from "papaparse";

// ------------------------------------------------------------
// Podcast Episodes Infographic — Card Grid (3 columns) + Stars
// ------------------------------------------------------------

const SAMPLE_DATA = `series_name,episode_title,pub_date_iso,tags,score_general,score_advanced,summary,url\n
Cleaning Up,Nuclear's Next Wave,2025-07-26,"nuclear; policy",4,5,"A conversation about advanced nuclear and timelines.",https://example.com/ep1\n
Climate One,Insurance in the Hot Zone,2025-08-10,"insurance, risk",5,4,"Why insurers are retreating; what it means for homeowners.",https://example.com/ep2\n
Volts,Grid nerd out: HVDC,2025-08-20,"grid, hvdc, transmission",5,5,"A deep dive on HVDC for a renewables-heavy grid.",https://example.com/ep3\n
Drilled,Litigation Update: 2025,2025-08-05,"litigation; attribution",3,5,"Roundup of major climate lawsuits and what to watch.",https://example.com/ep4`;

function parseDateSafe(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateShort(v) {
  const d = parseDateSafe(v);
  if (!d) return v || "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export default function PodcastEpisodesInfographic() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSeries, setSelectedSeries] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [last30Only, setLast30Only] = useState(false);
  const [maxResults, setMaxResults] = useState(200);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/episodes.csv", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const normalized = (parsed.data || [])
         .map((r) => normalizeRow(r))
         // drop empty/ghost rows with no identifying info
         .filter((r) => (r.series && r.series.length) || (r.title && r.title.length) || (r.url && r.url.length));
        if (!cancelled) {
          setRows(normalized);
          setLoading(false);
        }
      } catch (e) {
        console.warn("Falling back to SAMPLE_DATA due to:", e);
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const normalized = (parsed.data || [])
         .map((r) => normalizeRow(r))
         // drop empty/ghost rows with no identifying info
         .filter((r) => (r.series && r.series.length) || (r.title && r.title.length) || (r.url && r.url.length));
        if (!cancelled) {
          setRows(normalized);
          setLoading(false);
          setError("Using built-in sample data (episodes.csv not found).");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function normalizeRow(r) {
    const series = (r.series_name || r.Series || r.series || "").trim();
    const title = (r.episode_title || r.title || "").trim();
    const dateRaw = (r.pub_date_iso || r.date || r.published || "").trim();
    const dateObj = parseDateSafe(dateRaw);
    const tagsStr = (r.tags || r.Tags || "").toString();
    const tags = tagsStr.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);

    const sg = Number(r.score_general ?? r.general ?? r.general_score);
    const sa = Number(r.score_advanced ?? r.advanced ?? r.advanced_score);
    const scoreGen = isFinite(sg) && sg >= 1 && sg <= 5 ? Math.round(sg) : null;
    const scoreAdv = isFinite(sa) && sa >= 1 && sa <= 5 ? Math.round(sa) : null;

    const summaryGeneral = (r.summary_general || r.summaryGeneral || "").trim();
    const summaryAdvanced = (r.summary_advanced || r.summaryAdvanced || "").trim();
    const summary = (summaryGeneral || (r.summary || r.Summary || r.description || "")).trim();
    const url = (r.url || r.link || r.href || r.episode_url || "").trim();

    return { series, title, dateRaw, dateObj, tags, scoreGen, scoreAdv, summary, summaryGeneral, summaryAdvanced, url };
  }

  const allSeries = useMemo(() => uniqueSorted(rows.map((r) => r.series)), [rows]);
  const allTags = useMemo(() => uniqueSorted(rows.flatMap((r) => r.tags)), [rows]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const filtered = useMemo(() => {
    let out = rows;
    if (selectedSeries.length) out = out.filter((r) => selectedSeries.includes(r.series));
    if (selectedTags.length) out = out.filter((r) => r.tags.some((t) => selectedTags.includes(t)));
    if (last30Only) out = out.filter((r) => r.dateObj && r.dateObj >= cutoff);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.series.toLowerCase().includes(q) ||
          r.tags.join(",").toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q)
      );
    }
    return [...out].sort((a, b) => {
      const at = a.dateObj ? a.dateObj.getTime() : 0;
      const bt = b.dateObj ? b.dateObj.getTime() : 0;
      if (bt !== at) return bt - at;
      const s = a.series.localeCompare(b.series);
      if (s !== 0) return s;
      return a.title.localeCompare(b.title);
    });
  }, [rows, selectedSeries, selectedTags, last30Only, cutoff, search]);

  const limited = useMemo(() => (!maxResults || maxResults === -1 ? filtered : filtered.slice(0, maxResults)), [filtered, maxResults]);

  if (loading) return <div className="p-6 text-sm text-gray-700">Loading episodes…</div>;

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Climate Podcast Infographic</h1>
        <p className="text-sm text-gray-600">Filter by podcast series, tags, and time window. Hover/click any card to read the summary and open the episode.</p>
        {error && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 inline-block">{error}</div>}
      </header>

      {/* Controls */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-xs uppercase text-gray-600">Podcast Series</label>
          <MultiSelect options={allSeries} selected={selectedSeries} onChange={setSelectedSeries} placeholder="All series" />
        </div>
        <div className="space-y-1">
          <label className="block text-xs uppercase text-gray-600">Tags</label>
          <MultiSelect options={allTags} selected={selectedTags} onChange={setSelectedTags} placeholder="All tags" />
        </div>
        <div className="space-y-1">
          <label className="block text-xs uppercase text-gray-600">Search & Filters</label>
          <div className="flex items-center gap-2">
            <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={last30Only} onChange={(e) => setLast30Only(e.target.checked)} /> Last 30 days
            </label>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-600">Max results:</span>
            <select className="border rounded px-2 py-1 text-sm" value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))}>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={-1}>All</option>
            </select>
            <button className="ml-auto text-xs px-3 py-1.5 border rounded bg-white" onClick={() => {setSelectedSeries([]);setSelectedTags([]);setSearch("");setLast30Only(false);}}>Reset</button>
          </div>
        </div>
      </section>

      <div className="text-sm text-gray-700">Showing <strong>{limited.length}</strong> of <strong>{filtered.length}</strong> (from {rows.length} total).</div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {limited.map((r, idx) => <EpisodeCard key={`${r.series}|${r.title}|${r.dateRaw}|${idx}`} row={r} />)}
      </section>
    </div>
  );
}

function EpisodeCard({ row }) {
  const [open, setOpen] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) { if (cardRef.current && !cardRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={cardRef} className="relative border rounded-2xl p-4 bg-white shadow-sm hover:shadow-md" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="text-xs text-gray-500 mb-1 truncate" title={row.series}>{row.series}</div>
      <div className="font-medium">
        {row.url ? <a href={row.url} target="_blank" rel="noreferrer" className="hover:underline">{row.title}</a> : row.title}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1"><span className="text-xs text-gray-500">Gen</span>{row.scoreGen!=null?<StarRating value={row.scoreGen}/>:<span className="text-xs text-gray-400">—</span>}</div>
        <div className="flex items-center gap-1"><span className="text-xs text-gray-500">Adv</span>{row.scoreAdv!=null?<StarRating value={row.scoreAdv}/>:<span className="text-xs text-gray-400">—</span>}</div>
      </div>
      <button className="mt-3 text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={() => setOpen((v)=>!v)}>Details</button>
      {open && (
        <div className="absolute z-10 top-full left-4 right-4 mt-2 border rounded bg-white shadow-lg p-3">
          <div className="text-sm">
            <div className="font-semibold">{row.series}</div>
            <div>{row.title}</div>
            {row.dateRaw && <div className="text-xs text-gray-500">{formatDateShort(row.dateRaw)}</div>}

            {row.summaryGeneral ? (
              <p className="mt-2 text-gray-700">{row.summaryGeneral}</p>
            ) : row.summary ? (
              <p className="mt-2 text-gray-700">{row.summary}</p>
            ) : null}

            {row.summaryAdvanced ? (
              <div className="mt-2">
                <button className="text-xs underline" onClick={() => setShowAdv((s)=>!s)}>
                  {showAdv ? 'Hide advanced summary' : 'Show advanced summary'}
                </button>
                {showAdv && (
                  <p className="mt-1 text-gray-700"><span className="font-medium">Advanced: </span>{row.summaryAdvanced}</p>
                )}
              </div>
            ) : null}

            {row.url && (
              <p className="mt-2">
                <a href={row.url} target="_blank" rel="noreferrer" className="underline">Open episode ↗</a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StarRating({ value }) {
  if (value == null) return null;
  const v = Math.max(1, Math.min(5, Math.round(Number(value))));
  return <span aria-label={`${v} out of 5`}>{new Array(5).fill(0).map((_,i)=><span key={i} className={`text-sm ${i<v?"":"opacity-30"}`}>★</span>)}</span>;
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
