// =============================================================================
// eSSFHelperApp.jsx — eSSF Helper (single-file, fully branded, self-contained)
// Default export <App/>.
// =============================================================================

import React, { useState, useMemo, useRef } from "react";

// =============================================================================
// SampleBatchEditor.jsx  —  Sample & Batch ID Editor
// -----------------------------------------------------------------------------
// Self-contained React component. No external dependencies; all styles inline.
// Used identically in eSSF Helper (standalone) and eSSF Bench (TOOLS tile).
// THIS FILE IS THE SINGLE SOURCE OF TRUTH — copy it whole between repos.
//
// Props: formUrl (string), showHeader (bool), onBack (func)
//
// Features: real-world parser (built from 382 submissions); editable rows;
// same-batch or per-block batch assignment via shift-click/drag; optional 1-2
// descriptor columns typed in-cell with fill-selected; series generator for
// unknown counts; two locked comma+space outputs.
// =============================================================================


const FORM_URL_DEFAULT = "https://go.ncsu.edu/analytical-essf";

const PALETTE = [
  { bg: "#e1f4f8", fg: "#0e7e96" },
  { bg: "#efeafc", fg: "#6457ad" },
  { bg: "#eef6e6", fg: "#4d7a2e" },
  { bg: "#faeeda", fg: "#92590d" },
  { bg: "#e3edf7", fg: "#2c5d8f" },
  { bg: "#fdecea", fg: "#9a3b2f" },
];

const SEP = ", ";
const DESC_JOIN = "_";

// ===== PARSER (built by analyzing 382 real eSSF submissions) =================
// Lines first, then split each line on ; , tab, colon-pairs; strip leading
// numbering ("1 - ", "1.", "1)"); keep descriptive names whole; expand S/P
// shorthand. ~87% of real submissions parse into clean rows automatically;
// genuinely ambiguous prose stays one row for the user to edit in the table.
function stripLeadingIndex(s){
  // "1 - Foo", "1- Foo", "1. Foo", "1) Foo", "1 Foo" (only if rest is wordy)
  return s.replace(/^\s*\d+\s*[-.\):]\s+/, '').replace(/^\s*\d+[-.\)]\s*/, '').trim();
}

function expandUnit(t){
  if(/[\/|+]/.test(t)){
    const spaceForm=t.match(/^(.*\S)\s+([A-Za-z](?:\s*[\/|+]\s*[A-Za-z])+)$/);
    if(spaceForm){
      const stem=spaceForm[1].replace(/\s+/g,'');
      const sufs=spaceForm[2].split(/[\/|+]/).map(x=>x.trim()).filter(Boolean);
      return sufs.map(s=>stem+s.toUpperCase());
    }
    const m=t.match(/^(.*?)([A-Za-z])\s*[\/|+]\s*([A-Za-z](?:\s*[\/|+]\s*[A-Za-z])*)$/);
    if(m){
      const stem=m[1];
      const sufs=[m[2],...m[3].split(/[\/|+]/).map(x=>x.trim()).filter(Boolean)];
      return sufs.map(s=>stem.replace(/\s+/g,'')+s.toUpperCase());
    }
  }
  return [t.trim()];
}

// A line is "delimited" if it has ; or , or tab separating multiple entries.
// But ONLY split on those if the pieces look like separate samples — descriptive
// names with internal commas are rare here; semicolons are the dominant separator.
function looksLikeSpacedShorthand(line){
  // "1P/S 2P/S 3P/S" : multiple space-separated pieces, each containing a shorthand sep
  const pieces=line.split(/\s+/).filter(Boolean);
  return pieces.length>1 && pieces.every(p=>/[\/|+]/.test(p));
}
function splitInline(line){
  // colon as pair separator: "1210S: 1210P" -> two
  if(/:/.test(line) && !/\d{1,2}:\d{2}/.test(line)){ // avoid times
    const byColon=line.split(':').map(x=>x.trim()).filter(Boolean);
    if(byColon.length>1 && byColon.every(p=>p.length<=14)) return byColon;
  }
  // semicolons and tabs are strong separators; recurse so each segment gets
  // comma/shorthand handling too
  if(/[;\t]/.test(line)){
    return line.split(/[;\t]+/).flatMap(seg=>{
      seg=seg.trim(); if(!seg) return [];
      return splitInline(seg);
    });
  }
  // spaced shorthand on its own: "1P/S 2P/S 3P/S"
  if(looksLikeSpacedShorthand(line)) return line.split(/\s+/).filter(Boolean);
  // commas: only split if it looks like a comma-separated ID/short list (no long prose)
  if(/,/.test(line)){
    const byComma=line.split(',').map(x=>x.trim()).filter(Boolean);
    const shortish=byComma.filter(p=>p.length<=24).length;
    if(byComma.length>1 && shortish>=byComma.length-1){
      // a comma piece may itself be spaced shorthand ("3P/S 4P/S")
      return byComma.flatMap(p=>looksLikeSpacedShorthand(p)?p.split(/\s+/).filter(Boolean):[p]);
    }
  }
  return [line.trim()];
}

function parseSamples(raw){
  if(!raw.trim()) return [];
  // split into lines first
  const lines=raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let pieces=[];
  for(const line of lines){
    splitInline(line).forEach(p=>pieces.push(p));
  }
  // strip leading numbering, drop pure-number tokens that are just indices with nothing after
  const cleaned=[];
  for(let p of pieces){
    const stripped=stripLeadingIndex(p);
    if(!stripped) continue;
    // drop a stray "#" or trailing punctuation
    cleaned.push(stripped.replace(/[;,\s]+$/,'').trim());
  }
  // expand S/P shorthand on each
  const out=[];
  cleaned.forEach(u=>expandUnit(u).forEach(x=>out.push(x)));
  return out.filter(Boolean);
}

// ============================================================================

function SampleBatchEditor({
  formUrl = FORM_URL_DEFAULT,
  showHeader = false,
  onBack = null,
}) {
  const [raw, setRaw] = useState("");
  const [samples, setSamples] = useState([]); // {name, batch, d1, d2}
  const [loaded, setLoaded] = useState(false);
  const [expandedNote, setExpandedNote] = useState("");
  const [mode, setMode] = useState(null); // 'same' | 'diff'
  const [singleBatch, setSingleBatch] = useState("");
  const [descCols, setDescCols] = useState(0); // 0, 1, or 2 descriptor columns shown
  const [wantDesc, setWantDesc] = useState(null); // null (unanswered) | true | false
  const [checked, setChecked] = useState({});
  const [batchFill, setBatchFill] = useState("");
  const [descFill, setDescFill] = useState("");
  const [desc2Fill, setDesc2Fill] = useState("");
  const [warn, setWarn] = useState("");
  const [copiedField, setCopiedField] = useState(null);
  // series generator
  const [genOpen, setGenOpen] = useState(false);
  const [genPrefix, setGenPrefix] = useState("Sample ");
  const [genStart, setGenStart] = useState(1);
  const [genEnd, setGenEnd] = useState(10);

  const lastClicked = useRef(null);
  const dragging = useRef(false);
  const dragValue = useRef(true);

  const batchColors = useMemo(() => ({ map: {}, n: 0 }), [samples.length, mode]);
  function colorFor(b) {
    if (!(b in batchColors.map)) {
      batchColors.map[b] = batchColors.n % PALETTE.length;
      batchColors.n += 1;
    }
    return PALETTE[batchColors.map[b]];
  }

  // sample name + descriptors -> "1P_GroupA" or "1P_GroupA_TimeT0"
  function fullName(s) {
    let n = s.name;
    if (s.d1 && s.d1.trim()) n += DESC_JOIN + s.d1.trim();
    if (s.d2 && s.d2.trim()) n += DESC_JOIN + s.d2.trim();
    return n;
  }
  const outSamples = samples.map((s) => fullName(s)).join(SEP);
  const outBatches = samples.map((s) => s.batch || "NA").join(SEP);

  // batch is "set" depending on path
  const batchSet = (() => {
    if (!samples.length || !mode) return false;
    if (mode === "same") return singleBatch.trim().length > 0;
    if (mode === "diff") return samples.every((s) => s.batch && s.batch.length);
    return false;
  })();
  // step 3 appears once batch is set AND they've answered the descriptor question
  const batchInfoComplete = batchSet && wantDesc !== null;
  // the table shows only when they opted into descriptors, or when assigning different batches
  const showTable = mode === "diff" || (mode === "same" && wantDesc === true);

  function loadSamples() {
    const before = raw.split(/[\r\n,;\t ]+/).map((s) => s.trim()).filter(Boolean).length;
    const names = parseSamples(raw);
    if (!names.length) return;
    setSamples(names.map((n) => ({ name: n, batch: null, d1: "", d2: "" })));
    setExpandedNote(
      `\u2713 Read ${names.length} sample${names.length === 1 ? "" : "s"}${
        names.length > before ? " (formats untangled)" : ""
      }.`
    );
    setLoaded(true);
    setMode(null);
    setSingleBatch("");
    setWantDesc(null);
    setDescCols(0);
    setChecked({});
    setWarn("");
    lastClicked.current = null;
  }

  function pickMode(m) {
    setMode(m);
    setWantDesc(null); // re-ask the descriptor question per path
    setDescCols(0);
    if (m === "same") setSamples((prev) => prev.map((s) => ({ ...s, batch: singleBatch.trim() || null })));
    else setSamples((prev) => prev.map((s) => ({ ...s, batch: null })));
  }
  function pickWantDesc(v) {
    setWantDesc(v);
    setDescCols(v ? 1 : 0); // default to 1 column when they opt in
  }
  function onSingleChange(v) {
    setSingleBatch(v);
    setSamples((prev) => prev.map((s) => ({ ...s, batch: v.trim() || null })));
  }

  // ---- selection (shift-click range + click-drag) ----
  const checkedIdx = () => Object.keys(checked).filter((k) => checked[k]).map((k) => +k);
  function setRange(a, b, val) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    setChecked((prev) => {
      const next = { ...prev };
      for (let i = lo; i <= hi; i++) next[i] = val;
      return next;
    });
  }
  function handleRowMouseDown(i, e) {
    if (e.shiftKey && lastClicked.current !== null) {
      setRange(lastClicked.current, i, true);
      lastClicked.current = i;
      e.preventDefault();
      return;
    }
    const val = !checked[i];
    dragging.current = true;
    dragValue.current = val;
    setChecked((prev) => ({ ...prev, [i]: val }));
    lastClicked.current = i;
  }
  function handleRowMouseEnter(i) {
    if (dragging.current) setChecked((prev) => ({ ...prev, [i]: dragValue.current }));
  }
  function endDrag() { dragging.current = false; }

  // ---- apply batch and/or descriptor(s) to all selected rows at once ----
  function applyToSelected() {
    const idx = checkedIdx();
    if (!idx.length) return;
    const bv = batchFill.trim();
    setSamples((prev) => prev.map((s, i) => {
      if (!idx.includes(i)) return s;
      const next = { ...s };
      if (bv) next.batch = bv;
      if (descCols >= 1 && descFill !== "") next.d1 = descFill;
      if (descCols >= 2 && desc2Fill !== "") next.d2 = desc2Fill;
      return next;
    }));
    setBatchFill("");
    setDescFill("");
    setDesc2Fill("");
    setChecked({});
  }

  // ---- inline cell editing ----
  function editCell(i, field, value) {
    setSamples((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  // ---- series generator: fills the input box so the user sees the full list ----
  function generateSeries() {
    const a = parseInt(genStart, 10), b = parseInt(genEnd, 10);
    if (isNaN(a) || isNaN(b) || b < a) return;
    const items = [];
    for (let n = a; n <= b; n++) items.push(`${genPrefix}${n}`.trim());
    // append to whatever is already typed, comma-separated
    const existing = raw.trim();
    const joined = items.join(", ");
    setRaw(existing ? existing + ", " + joined : joined);
    setGenOpen(false); // collapse the generator, return focus to the (now-filled) box
  }

  function validate() {
    const nS = samples.length;
    const nB = samples.map((s) => s.batch || "NA").filter((x) => x.length).length;
    if (nS === 0) return { ok: false, msg: "Add at least one sample before copying." };
    if (nS !== nB) return { ok: false, msg: `Sample count (${nS}) must equal Batch ID count (${nB}).` };
    return { ok: true };
  }
  function copyField(text, which) {
    const v = validate();
    if (!v.ok) { setWarn(`\u26A0\uFE0F ${v.msg}`); return; }
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(which);
      setTimeout(() => setCopiedField(null), 1200);
    });
  }

  const nS = samples.length;
  const un = samples.filter((s) => !s.batch).length;
  const usedBatches = [...new Set(samples.map((s) => s.batch).filter(Boolean))];
  const selCount = checkedIdx().length;

  const C = {
    page: { fontFamily: "system-ui,-apple-system,sans-serif", color: "#0b2a6f", background: showHeader ? "linear-gradient(180deg,#d7e7fb 0%,#f4f9fd 30%,#ffffff 100%)" : "#f4f7fb", minHeight: showHeader ? "100vh" : "auto" },
    topbar: { position: "sticky", top: 0, zIndex: 50, background: "#0b2a6f", color: "#fff", display: "flex", alignItems: "center", gap: 18, padding: "0 22px", height: 56 },
    tbTool: { fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: "#7fd2e3", textTransform: "uppercase" },
    tbDivider: { width: 1, height: 22, background: "#2a4a93" },
    back: { background: "#16357f", border: "1px solid #2a4a93", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, padding: "7px 14px", cursor: "pointer", marginLeft: "auto" },
    col: { width: "min(760px,100%)", margin: "0 auto", padding: "24px 16px 56px" },
    h1: { fontSize: 19, fontWeight: 600, margin: "0 0 2px" },
    sub: { fontSize: 13, color: "#5a6984", margin: "0 0 20px" },
    panel: { background: "#fff", border: "1px solid #dfe7f2", borderRadius: 12, padding: "16px 18px", marginBottom: 14 },
    h2: { fontSize: 11, letterSpacing: 1.2, color: "#8e9bb5", textTransform: "uppercase", margin: "0 0 10px", fontWeight: 600 },
    textarea: { width: "100%", minHeight: 110, border: "1px solid #dfe7f2", borderRadius: 8, padding: "10px 12px", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 13, color: "#0b2a6f", resize: "vertical", boxSizing: "border-box" },
    hint: { fontSize: 11.5, color: "#8e9bb5", margin: "6px 0 0", lineHeight: 1.5 },
    btnPrimary: { border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#139cb6", color: "#fff" },
    btnGhost: { border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#eef4fb", color: "#2c5d8f" },
    linkBtn: { border: "none", background: "none", color: "#139cb6", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" },
    note: { fontSize: 12, color: "#2f7d4f", background: "#edf7f0", border: "1px solid #cce9d6", borderRadius: 7, padding: "7px 11px", marginTop: 10 },
    q: { fontSize: 14, fontWeight: 600, margin: "0 0 12px" },
    choices: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 },
    choice: (active) => ({ border: active ? "1px solid #139cb6" : "1px solid #dfe7f2", background: active ? "#139cb6" : "#fff", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: active ? "#fff" : "#2c5d8f" }),
    singleInput: { border: "1px solid #cfdcea", borderRadius: 7, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", flex: 1, minWidth: 160, boxSizing: "border-box" },
    smallInput: { border: "1px solid #cfdcea", borderRadius: 6, padding: "6px 9px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" },
    fillBar: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#f1f8fb", border: "1px solid #cfeaf1", borderRadius: 8, padding: "10px 12px", marginBottom: 12 },
    genBar: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#f7f4fc", border: "1px solid #e3dbf3", borderRadius: 8, padding: "10px 12px", marginTop: 10 },
    selHint: { fontSize: 11.5, color: "#8e9bb5", margin: "0 0 10px" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13, userSelect: "none" },
    th: { fontSize: 11, letterSpacing: 0.5, color: "#8e9bb5", textTransform: "uppercase", textAlign: "left", padding: "6px 8px", fontWeight: 600, borderBottom: "1px solid #eef2f8" },
    td: { padding: "6px 8px", borderBottom: "1px solid #f1f5fa", verticalAlign: "middle" },
    cellEdit: { fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 13, color: "#0b2a6f", border: "1px solid transparent", borderRadius: 5, padding: "4px 6px", width: "100%", boxSizing: "border-box", background: "transparent" },
    descEdit: { fontSize: 12.5, color: "#2c5d8f", border: "1px solid #eef2f8", borderRadius: 5, padding: "4px 6px", width: "100%", boxSizing: "border-box", background: "#fafbfe" },
    pill: (c) => ({ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: c.bg, color: c.fg }),
    none: { color: "#aab2c2", fontStyle: "italic", fontSize: 12 },
    legend: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "#5a6984", alignItems: "center" },
    descCtl: { display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "#5a6984", marginBottom: 10, flexWrap: "wrap" },
    seg: { display: "inline-flex", border: "1px solid #dfe7f2", borderRadius: 8, overflow: "hidden" },
    divider: { height: 1, background: "#eef2f8", margin: "16px 0" },
    segBtn: (on) => ({ border: "none", background: on ? "#139cb6" : "#fff", color: on ? "#fff" : "#2c5d8f", padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", borderRight: "1px solid #dfe7f2" }),
    outField: { marginBottom: 14 },
    outLabel: { fontSize: 12, fontWeight: 600, color: "#2c5d8f", display: "block", marginBottom: 5 },
    outBox: { display: "flex", gap: 8, alignItems: "stretch" },
    outTextarea: { width: "100%", minHeight: 52, border: "1px solid #dfe7f2", borderRadius: 8, padding: "10px 12px", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 12.5, color: "#0b2a6f", resize: "vertical", boxSizing: "border-box" },
    warn: { fontSize: 12.5, color: "#9a3b2f", background: "#fdecea", border: "1px solid #f6cfca", borderRadius: 8, padding: "9px 12px", marginBottom: 12 },
    ok: { color: "#2f7d4f" },
    openLink: { display: "inline-block", textDecoration: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, background: "#139cb6", color: "#fff" },
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div style={C.page} onMouseUp={endDrag} onMouseLeave={endDrag}>
      {showHeader && (
        <div style={C.topbar}>
          {/* eSSF Helper logo lockup — white/teal, matches the HTML BatchTool header */}
          <svg style={{ height: 24, width: "auto", display: "block" }} viewBox="0 0 460 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="eSSF Helper">
            <text x="0" y="78" fontFamily="Inter,system-ui,Arial,sans-serif" fontWeight="600" letterSpacing="-1.5" fontSize="62" fill="#ffffff">eSSF</text>
            <text x="142" y="78" fontFamily="Inter,system-ui,Arial,sans-serif" fontWeight="600" letterSpacing="-1.5" fontSize="62" fill="#7fd2e3">Helper</text>
            <g transform="translate(322 22) scale(0.28)" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <circle cx="64" cy="38" r="20" stroke="#ffffff" strokeWidth="13" />
              <path d="M33 118V89C33 70 47 58 64 58C81 58 95 70 95 89V118" stroke="#ffffff" strokeWidth="13" />
              <circle cx="224" cy="38" r="20" stroke="#ffffff" strokeWidth="13" />
              <path d="M193 118V89C193 70 207 58 224 58C241 58 255 70 255 89V118" stroke="#ffffff" strokeWidth="13" />
              <path d="M95 119C113 89 133 78 160 78C187 78 207 89 225 119" stroke="#ffffff" strokeWidth="13" />
              <path d="M44 119H102" stroke="#7fd2e3" strokeWidth="13" />
              <path d="M217 119H275" stroke="#7fd2e3" strokeWidth="13" />
              <path d="M126 64H179L202 87V168H126Z" fill="#0b2a6f" stroke="#ffffff" strokeWidth="13" />
              <path d="M179 64V87H202" stroke="#ffffff" strokeWidth="13" />
              <path d="M145 107H177M145 127H177" stroke="#7fd2e3" strokeWidth="10" />
              <path d="M146 147l7 7 12-15" stroke="#7fd2e3" strokeWidth="10" />
            </g>
          </svg>
          <span style={C.tbDivider} />
          <span style={C.tbTool}>Sample &amp; Batch ID Editor</span>
          <button style={C.back} onClick={() => onBack && onBack()}>&#8592; Back</button>
        </div>
      )}

      <div style={C.col}>
        <h1 style={C.h1}>Sample &amp; Batch ID Editor</h1>
        <p style={C.sub}>Build and edit your sample and batch ID lists, then copy two ready-to-paste fields for the eSSF request form.</p>

        {/* STEP 1 */}
        <div style={C.panel}>
          <p style={C.h2}>1 &middot; Enter your samples</p>

          {!genOpen && (
            <>
              <textarea
                style={C.textarea}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={"Paste however your samples come, e.g.\n1350S, 1350P\nor  GFP Harvest P; GFP Harvest S\nor  1 - Clarified Lysate Group A\n    2 - Q-eluate Group A\nor  BR1330_S; BR1330_P"}
              />
              <p style={C.hint}>
                Paste numbered lists, semicolon/comma lists, descriptive names, or shorthand
                (<code>1P/S</code> → <code>1P, 1S</code>). The editor untangles common formats; fix any name by clicking it below.
              </p>
              <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button style={C.btnPrimary} onClick={loadSamples}>Continue</button>
                <button style={C.linkBtn} onClick={() => setGenOpen(true)}>
                  Don&rsquo;t know the exact count? Generate a numbered series
                </button>
              </div>
            </>
          )}

          {genOpen && (
            <div>
              <p style={{ fontSize: 13, color: "#2c5d8f", fontWeight: 600, margin: "0 0 10px" }}>Generate a numbered series</p>
              <div style={C.genBar}>
                <span style={{ fontSize: 12.5, color: "#5a6984" }}>Name them</span>
                <input style={{ ...C.smallInput, width: 120 }} value={genPrefix} onChange={(e) => setGenPrefix(e.target.value)} placeholder="Prefix (e.g. Fraction )" />
                <span style={{ color: "#8e9bb5" }}>from</span>
                <input style={{ ...C.smallInput, width: 64 }} type="number" value={genStart} onChange={(e) => setGenStart(e.target.value)} />
                <span style={{ color: "#8e9bb5" }}>to</span>
                <input style={{ ...C.smallInput, width: 64 }} type="number" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} />
                <button style={C.btnPrimary} onClick={generateSeries}>Generate</button>
                <button style={C.btnGhost} onClick={() => setGenOpen(false)}>Cancel</button>
              </div>
              <p style={C.hint}>
                Preview: <code>{genPrefix}{genStart || 1}, {genPrefix}{(parseInt(genStart, 10) || 1) + 1}, … {genPrefix}{genEnd || 10}</code>
                &nbsp;— this fills the box above so you can review and edit the full list, then hit Continue.
              </p>
            </div>
          )}

          {expandedNote && <div style={C.note}>{expandedNote}</div>}
        </div>

        {/* STEP 2 */}
        {loaded && (
          <div style={C.panel}>
            <p style={C.h2}>2 &middot; Assign batch IDs</p>

            {/* Question 1: same batch? */}
            <p style={C.q}>Do all of these samples belong to the same batch?</p>
            <div style={C.choices}>
              <button style={C.choice(mode === "same")} onClick={() => pickMode("same")}>Yes — one batch</button>
              <button style={C.choice(mode === "diff")} onClick={() => pickMode("diff")}>No — different batches</button>
            </div>

            {mode === "same" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
                <input style={C.singleInput} value={singleBatch} onChange={(e) => onSingleChange(e.target.value)} placeholder="Batch ID for all samples (e.g. BR1210, or type NA if none)" />
              </div>
            )}

            {/* Question 2: descriptors? — appears once batch is set */}
            {batchSet && (
              <>
                <div style={C.divider} />
                <p style={C.q}>Do you need to add descriptors? <span style={{ fontWeight: 400, fontSize: 12.5, color: "#8e9bb5" }}>(e.g. a class group, timepoint)</span></p>
                <div style={C.choices}>
                  <button style={C.choice(wantDesc === true)} onClick={() => pickWantDesc(true)}>Yes — add descriptors</button>
                  <button style={C.choice(wantDesc === false)} onClick={() => pickWantDesc(false)}>No</button>
                </div>

                {wantDesc === true && (
                  <div style={{ ...C.descCtl, marginTop: 12 }}>
                    <span>How many?</span>
                    <span style={C.seg}>
                      {[1, 2].map((n) => (
                        <button key={n} style={C.segBtn(descCols === n)} onClick={() => setDescCols(n)}>{n}</button>
                      ))}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#8e9bb5" }}>type in a cell, or select rows and apply below. Appends to the name like <code>1P_GroupA</code>.</span>
                  </div>
                )}
              </>
            )}

            {/* Table: shown for different-batches, or one-batch + descriptors */}
            {showTable && (
              <div style={{ marginTop: 14 }}>
                <p style={C.selHint}>
                  Select a block: click a row, then <strong>Shift-click</strong> another — or <strong>click and drag</strong>.
                  Then set {mode === "diff" ? "the batch" : "the descriptor"}{descCols > 0 && mode === "diff" ? " and/or descriptor" : ""} for all selected at once.
                </p>

                {selCount > 0 && (
                  <div style={{ ...C.fillBar, flexDirection: descCols >= 2 ? "column" : "row", alignItems: descCols >= 2 ? "stretch" : "center" }}>
                    <span style={{ fontSize: 12.5, color: "#2c5d8f", fontWeight: 600 }}>Set for {selCount} selected:</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {mode === "diff" && (
                        <input style={{ ...C.singleInput, minWidth: 100 }} value={batchFill} onChange={(e) => setBatchFill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyToSelected()} placeholder="Batch ID" />
                      )}
                      {descCols >= 1 && (
                        <input style={{ ...C.singleInput, minWidth: 110 }} value={descFill} onChange={(e) => setDescFill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyToSelected()} placeholder={descCols >= 2 ? "Descriptor 1" : "Descriptor"} />
                      )}
                      {descCols >= 2 && (
                        <input style={{ ...C.singleInput, minWidth: 110 }} value={desc2Fill} onChange={(e) => setDesc2Fill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyToSelected()} placeholder="Descriptor 2" />
                      )}
                      <button style={C.btnPrimary} onClick={applyToSelected}>Apply to selected</button>
                      <button style={C.btnGhost} onClick={() => setChecked({})}>Clear</button>
                    </div>
                  </div>
                )}

                <table style={C.table}>
                  <thead>
                    <tr>
                      <th style={{ ...C.th, width: 30 }}></th>
                      <th style={C.th}>Sample</th>
                      {descCols >= 1 && <th style={C.th}>{descCols >= 2 ? "Descriptor 1" : "Descriptor"}</th>}
                      {descCols >= 2 && <th style={C.th}>Descriptor 2</th>}
                      <th style={C.th}>Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((s, i) => (
                      <tr key={i} onMouseDown={(e) => handleRowMouseDown(i, e)} onMouseEnter={() => handleRowMouseEnter(i)} style={{ ...(checked[i] ? { background: "#f1f8fb" } : {}), cursor: "pointer" }}>
                        <td style={C.td}>
                          <input type="checkbox" readOnly checked={!!checked[i]} style={{ width: 15, height: 15, accentColor: "#139cb6", pointerEvents: "none" }} />
                        </td>
                        <td style={C.td} onMouseDown={stop}>
                          <input value={s.name} onChange={(e) => editCell(i, "name", e.target.value)} style={C.cellEdit} title="Click to edit" />
                        </td>
                        {descCols >= 1 && (
                          <td style={C.td} onMouseDown={stop}>
                            <input value={s.d1} onChange={(e) => editCell(i, "d1", e.target.value)} style={C.descEdit} placeholder="—" />
                          </td>
                        )}
                        {descCols >= 2 && (
                          <td style={C.td} onMouseDown={stop}>
                            <input value={s.d2} onChange={(e) => editCell(i, "d2", e.target.value)} style={C.descEdit} placeholder="—" />
                          </td>
                        )}
                        <td style={C.td}>
                          {s.batch ? <span style={C.pill(colorFor(s.batch))}>{s.batch}</span> : <span style={C.none}>unassigned</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {usedBatches.length > 0 && mode === "diff" && (
                  <div style={C.legend}>Batches: {usedBatches.map((b) => <span key={b} style={C.pill(colorFor(b))}>{b}</span>)}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {batchInfoComplete && (
          <div style={C.panel}>
            <p style={C.h2}>3 &middot; Copy to the request form</p>
            {warn && <div style={C.warn}>{warn}</div>}
            {!warn && nS > 0 && (
              <div style={{ ...C.warn, color: un > 0 ? "#9a3b2f" : "#2f7d4f", background: un > 0 ? "#fdecea" : "#edf7f0", borderColor: un > 0 ? "#f6cfca" : "#cce9d6" }}>
                {un > 0
                  ? <span>{`${un} of ${nS} samples export as NA. Counts still match (${nS} = ${nS}).`}</span>
                  : <span style={C.ok}>{`\u2713 All ${nS} samples assigned. Sample count = Batch count = ${nS}.`}</span>}
              </div>
            )}
            <div style={C.outField}>
              <label style={C.outLabel}>Field 1 — Sample Name(s){descCols > 0 ? " (with descriptor)" : ""}</label>
              <div style={C.outBox}>
                <textarea style={C.outTextarea} readOnly value={outSamples} />
                <button style={C.btnPrimary} onClick={() => copyField(outSamples, "s")}>{copiedField === "s" ? "Copied" : "Copy"}</button>
              </div>
            </div>
            <div style={C.outField}>
              <label style={C.outLabel}>Field 2 — Batch ID</label>
              <div style={C.outBox}>
                <textarea style={C.outTextarea} readOnly value={outBatches} />
                <button style={C.btnPrimary} onClick={() => copyField(outBatches, "b")}>{copiedField === "b" ? "Copied" : "Copy"}</button>
              </div>
            </div>
            <div><a style={C.openLink} href={formUrl} target="_blank" rel="noopener noreferrer">Open the eSSF request form &#8599;</a></div>
            <p style={{ ...C.hint, marginTop: 10 }}>Open the form, then <strong>Copy</strong> each field above and paste it into the matching box on the form.</p>
          </div>
        )}
      </div>
    </div>
  );
}


// =============================================================================
// Landing.jsx — eSSF Helper landing page
// Faithful React port of eSSF_Helper_v1_training.html (approved design).
// Same logo lockup, greeting, SUBMISSIONS + TOOLS tiles, footer.
// The "Sample & Batch ID Editor" tile calls onOpenEditor() to navigate.
// =============================================================================


const FORM_URL = "https://go.ncsu.edu/analytical-essf";
const ERF_URL = "https://go.ncsu.edu/analytical-erf";
const LIMS_URL = "https://go.ncsu.edu/analytical-lims";

function Landing({ onOpenEditor }) {
  const S = {
    wrap: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "clamp(0.5rem,2vh,1.5rem) 0", background: "linear-gradient(180deg,#d7e7fb 0%,#f4f9fd 45%,#ffffff 100%)" },
    col: { width: "min(720px,100%)", padding: "0.75rem 1rem" },
    hero: { textAlign: "center", padding: "0.25rem 0 0.75rem" },
    greetblock: { marginBottom: "1.5rem", textAlign: "center" },
    greet: { fontSize: 14, color: "#5a6984", margin: "0 0 2px" },
    ask: { fontSize: 19, fontWeight: 500, color: "#0b2a6f", margin: 0 },
    section: { marginBottom: "1.25rem" },
    eyebrow: { fontSize: 11, color: "#8e9bb5", letterSpacing: "1.2px", margin: "0 0 10px" },
    card: { display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #dfe7f2", borderRadius: 12, padding: "14px 18px", minHeight: 64, marginBottom: 10, textDecoration: "none", cursor: "pointer", transition: "all 0.15s" },
    icon: { width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center" },
    iconImg: { width: 46, height: 46, borderRadius: "50%", flexShrink: 0, objectFit: "cover" },
    ctext: { flex: 1, minWidth: 0 },
    ctitle: { fontSize: 14, fontWeight: 600, color: "#0b2a6f", margin: 0 },
    csub: { fontSize: 12, color: "#5a6984", margin: "2px 0 0" },
    chev: { color: "#8e9bb5", fontSize: 18, fontWeight: 300, flexShrink: 0 },
    foot: { borderTop: "1px solid #dfe7f2", paddingTop: "1rem", marginTop: "0.5rem", textAlign: "center" },
    footLabel: { fontSize: 11.5, color: "#8e9bb5", letterSpacing: "0.3px", margin: 0 },
    footCredit: { fontSize: 10.5, color: "#aab4c6", letterSpacing: "0.2px", margin: "5px 0 0" },
    sibs: { fontSize: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" },
    sibLink: { color: "#139cb6", textDecoration: "none" },
    sep: { fontSize: 10, color: "#8e9bb5" },
  };

  return (
    <div style={S.wrap}>
      <div style={S.col}>
        {/* HERO — eSSF Helper lockup */}
        <div style={S.hero}>
          <svg style={{ width: 208, height: "auto", display: "block", margin: "0 auto" }} viewBox="0 0 690 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="eSSF Helper">
            <text x="24" y="150" fontFamily="Inter,system-ui,Arial,sans-serif" fontWeight="500" letterSpacing="-2" fontSize="108" fill="#0B2A6F">eSSF</text>
            <text x="272" y="150" fontFamily="Inter,system-ui,Arial,sans-serif" fontWeight="500" letterSpacing="-2" fontSize="108" fill="#139CB6">Helper</text>
            <path d="M268 168H540" stroke="#139CB6" strokeWidth="6" fill="none" strokeLinecap="round" />
            <g transform="translate(556 62) scale(0.42)" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <circle cx="64" cy="38" r="20" stroke="#0B2A6F" strokeWidth="13" />
              <path d="M33 118V89C33 70 47 58 64 58C81 58 95 70 95 89V118" stroke="#0B2A6F" strokeWidth="13" />
              <circle cx="224" cy="38" r="20" stroke="#0B2A6F" strokeWidth="13" />
              <path d="M193 118V89C193 70 207 58 224 58C241 58 255 70 255 89V118" stroke="#0B2A6F" strokeWidth="13" />
              <path d="M95 119C113 89 133 78 160 78C187 78 207 89 225 119" stroke="#0B2A6F" strokeWidth="13" />
              <path d="M44 119H102" stroke="#139CB6" strokeWidth="13" />
              <path d="M217 119H275" stroke="#139CB6" strokeWidth="13" />
              <path d="M126 64H179L202 87V168H126Z" fill="#fff" stroke="#0B2A6F" strokeWidth="13" />
              <path d="M179 64V87H202" fill="#EAF7FB" stroke="#0B2A6F" strokeWidth="13" />
              <path d="M145 107H177M145 127H177" stroke="#139CB6" strokeWidth="10" />
              <path d="M146 147l7 7 12-15" stroke="#139CB6" strokeWidth="10" />
            </g>
          </svg>
        </div>

        <div style={S.greetblock}>
          <p style={S.greet}>Hi there,</p>
          <p style={S.ask}>what do you need help with today?</p>
        </div>

        {/* SUBMIT A REQUEST */}
        <div style={S.section}>
          <p style={S.eyebrow}>SUBMIT A REQUEST</p>
          <a style={{ ...S.card, borderTop: "2px solid #139cb6" }} href={FORM_URL} target="_blank" rel="noopener noreferrer">
            <img src="data:image/png;base64,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" alt="" style={S.iconImg} />
            <span style={S.ctext}>
              <span style={{ ...S.ctitle, display: "block" }}>Submit samples for analysis</span>
              <span style={{ ...S.csub, display: "block" }}>Sample submission form (eSSF)</span>
            </span>
            <span style={S.chev}>&#8250;</span>
          </a>

          <a style={{ ...S.card, borderTop: "2px solid #139cb6" }} href={ERF_URL} target="_blank" rel="noopener noreferrer">
            <img src="data:image/png;base64,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" alt="" style={S.iconImg} />
            <span style={S.ctext}>
              <span style={{ ...S.ctitle, display: "block" }}>Borrow equipment or reagents</span>
              <span style={{ ...S.csub, display: "block" }}>Equipment, reagents, or lab space (eRF)</span>
            </span>
            <span style={S.chev}>&#8250;</span>
          </a>
        </div>

        {/* RESULTS & DATA */}
        <div style={S.section}>
          <p style={S.eyebrow}>RESULTS &amp; DATA</p>
          <a style={{ ...S.card, borderTop: "2px solid #6457ad" }} href={LIMS_URL} target="_blank" rel="noopener noreferrer">
            <img src="data:image/png;base64,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" alt="" style={S.iconImg} />
            <span style={S.ctext}>
              <span style={{ ...S.ctitle, display: "block" }}>Check results &amp; past reports</span>
              <span style={{ ...S.csub, display: "block" }}>Current results and past data (LIMS)</span>
            </span>
            <span style={S.chev}>&#8250;</span>
          </a>
        </div>

        {/* TOOLS */}
        <div style={S.section}>
          <p style={S.eyebrow}>TOOLS</p>
          <div style={{ ...S.card, borderTop: "2px solid #2c5d8f" }} onClick={onOpenEditor} role="button" tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenEditor()}>
            <img src="data:image/png;base64,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" alt="" style={S.iconImg} />
            <span style={S.ctext}>
              <span style={{ ...S.ctitle, display: "block" }}>Build my sample &amp; batch ID lists</span>
              <span style={{ ...S.csub, display: "block" }}>Get your list form-ready (Sample &amp; Batch ID Editor)</span>
            </span>
            <span style={S.chev}>&#8250;</span>
          </div>
        </div>

        {/* FOOTER */}
        <div style={S.foot}>
          <p style={S.footLabel}>Part of the eSSF analytical system</p>
          <p style={S.footCredit}>C. Gracieux-Singleton · 2025</p>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const [view, setView] = React.useState("home");
  if (view === "editor") return <SampleBatchEditor showHeader={true} onBack={() => setView("home")} />;
  return <Landing onOpenEditor={() => setView("editor")} />;
}
