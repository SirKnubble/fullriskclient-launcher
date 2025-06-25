import React from "react";
import ReactDOM from "react-dom/client";
import { FriendsWindow } from "./components/friends/FriendsWindow";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FriendsWindow />
    <GlobalToaster />
  </React.StrictMode>
);
