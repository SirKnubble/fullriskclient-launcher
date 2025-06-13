import React from "react";
import ReactDOM from "react-dom/client";
import { LogWindow } from "./components/log/LogWindow";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LogWindow />
    <GlobalToaster />
  </React.StrictMode>,
);
