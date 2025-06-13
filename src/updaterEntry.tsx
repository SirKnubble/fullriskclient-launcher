import React from "react";
import ReactDOM from "react-dom/client";
import Updater from "./components/updater/Updater";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Updater />
  </React.StrictMode>,
);
