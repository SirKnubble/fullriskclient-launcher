import React from "react";
import ReactDOM from "react-dom/client";
import { MinecraftLogWindow } from "./components/log/MinecraftLogWindow";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MinecraftLogWindow />
    <GlobalToaster />
  </React.StrictMode>,
);
