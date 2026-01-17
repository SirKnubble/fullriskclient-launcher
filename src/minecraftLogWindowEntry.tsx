import React from "react";
import ReactDOM from "react-dom/client";
import { MinecraftLogWindow } from "./components/log/MinecraftLogWindow";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import "./styles/globals.css";
import type { ProcessMetadata } from "./types/processState";

// Parse URL params for crashed process info
const urlParams = new URLSearchParams(window.location.search);
const crashedProcessParam = urlParams.get("crashedProcess");
let crashedProcess: ProcessMetadata | undefined;

if (crashedProcessParam) {
  try {
    crashedProcess = JSON.parse(crashedProcessParam) as ProcessMetadata;
    console.log("[MinecraftLogWindowEntry] Parsed crashed process:", crashedProcess);
  } catch (e) {
    console.error("[MinecraftLogWindowEntry] Failed to parse crashed process:", e);
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MinecraftLogWindow crashedProcess={crashedProcess} />
    <GlobalToaster />
  </React.StrictMode>,
);
