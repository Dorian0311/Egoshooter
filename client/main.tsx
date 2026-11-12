import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
const preview =
  import.meta.env.DEV && import.meta.env.VITE_SHOOTER_PREVIEW === true;
createRoot(document.getElementById("root")!).render(
  <App
    accessToken={
      preview
        ? new URLSearchParams(location.search).get("player") === "b"
          ? "preview-b"
          : "preview-a"
        : undefined
    }
  />,
);
