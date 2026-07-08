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

import React, { useState, useMemo, useRef } from "react";

const FORM_URL_DEFAULT = "https://go.ncsu.edu/analytical-essf";

const PALETTE = [
  { bg: "#e1f4f8", fg: "#0e7e96" },
  { bg: "#efeafc", fg: "#6457ad" },
  { bg: "#eef6e6", fg: "#4d7a2e" },
  { bg: "#faeeda", fg: "#92590d" },
  { bg: "#e3edf7", fg: "#2c5d8f" },
  { bg: "#fdecea", fg: "#9a3b2f" },
];

const SEP = ",";
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

export default function SampleBatchEditor({
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
