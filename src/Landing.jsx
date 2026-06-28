// =============================================================================
// Landing.jsx — eSSF Helper landing page
// Faithful React port of eSSF_Helper_v1_training.html (approved design).
// Same logo lockup, greeting, SUBMISSIONS + TOOLS tiles, footer.
// The "Sample & Batch ID Editor" tile calls onOpenEditor() to navigate.
// =============================================================================

import React from "react";

const FORM_URL = "https://go.ncsu.edu/analytical-essf";
const ERF_URL = "https://go.ncsu.edu/analytical-erf";
const LIMS_URL = "https://go.ncsu.edu/analytical-lims";

export default function Landing({ onOpenEditor }) {
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
            <img src="/icons/icon-essf.png" alt="" style={S.iconImg} />
            <span style={S.ctext}>
              <span style={{ ...S.ctitle, display: "block" }}>Submit samples for analysis</span>
              <span style={{ ...S.csub, display: "block" }}>Sample submission form (eSSF)</span>
            </span>
            <span style={S.chev}>&#8250;</span>
          </a>

          <a style={{ ...S.card, borderTop: "2px solid #139cb6" }} href={ERF_URL} target="_blank" rel="noopener noreferrer">
            <img src="/icons/icon-erf.png" alt="" style={S.iconImg} />
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
            <img src="/icons/icon-lims.png" alt="" style={S.iconImg} />
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
            <img src="/icons/icon-editor.png" alt="" style={S.iconImg} />
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
          <p style={S.footCredit}>Created and developed by C. Gracieux-Singleton · 2026</p>
        </div>
      </div>
    </div>
  );
}
