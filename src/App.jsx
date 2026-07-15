// =============================================================================
// App.jsx — eSSF Helper
// Top-level navigation between the landing page and the Sample & Batch ID Editor.
// Simple view-state switch (no router needed for two screens).
// =============================================================================

import React, { useState } from "react";
import Landing from "./Landing.jsx";
import SampleBatchEditor from "./SampleBatchEditor.jsx";

export default function App() {
  const [view, setView] = useState("home"); // 'home' | 'editor'

  if (view === "editor") {
    return (
      <SampleBatchEditor
        showHeader={true}
        onBack={() => setView("home")}
      />
    );
  }

  return <Landing onOpenEditor={() => setView("editor")} />;
}
