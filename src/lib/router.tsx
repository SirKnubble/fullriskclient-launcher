import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "../App";
import { PlayTab } from "../components/tabs/PlayTab";
import { ProfilesTab } from "../components/tabs/ProfilesTab";
import ModrinthTabV2 from "../components/tabs/ModrinthTabV2";
import { SkinsTab } from "../components/tabs/SkinsTab";
import { StoreTab } from "../components/tabs/StoreTab";
import { SettingsTab } from "../components/tabs/SettingsTab";
import { BrowseTab } from "../components/profiles/detail/BrowseTab";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/play" replace />,
      },
      {
        path: "play",
        element: <PlayTab />,
      },
      {
        path: "profiles/:profileId",
        element: <ProfilesTab />,
      },
      {
        path: "profiles",
        element: <ProfilesTab />,
      },
      {
        path: "profiles/:profileId/browse/:contentType",
        element: <BrowseTab />,
      },
      {
        path: "mods",
        element: <ModrinthTabV2 />,
      },
      {
        path: "skins",
        element: <SkinsTab />,
      },
      {
        path: "capes",
        element: <StoreTab />,
      },
      {
        path: "settings",
        element: <SettingsTab />,
      },
    ],
  },
]);
