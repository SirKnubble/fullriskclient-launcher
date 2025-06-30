import React from "react";
import ReactDOM from "react-dom/client";
import { FriendsWindow } from "./components/friends/FriendsWindow";
import { GlobalToaster } from "./components/ui/GlobalToaster";
import { ThemeInitializer } from "./components/ThemeInitializer";
import { useGlobalWebSocketEvents } from "./hooks/useGlobalWebSocketEvents";
import "./styles/globals.css";

function FriendsWindowApp() {
  useGlobalWebSocketEvents('friends');
  
  return (
    <>
      <ThemeInitializer />
      <FriendsWindow />
      <GlobalToaster />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <FriendsWindowApp />
);
