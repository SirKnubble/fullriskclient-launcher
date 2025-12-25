import React from "react";
import ReactDOM from "react-dom/client";
import { SingleLogViewer } from "./components/log/SingleLogViewer";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import "./styles/globals.css";

// Get instance info from URL params
const urlParams = new URLSearchParams(window.location.search);
const instanceId = urlParams.get("instanceId") || undefined;
const instanceName = urlParams.get("instanceName") || undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SingleLogViewer instanceId={instanceId} instanceName={instanceName} />
    <GlobalToaster />
  </React.StrictMode>,
);
