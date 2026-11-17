import React, { useEffect, useState } from "react";
import Landing from "./Landing";
import CertApp from "./CertApp";

// Hash routing: "#/" = landing page, "#/app" = the live app.
// Hash routes work on Vercel with no extra config, and QR links keep working.
function isAppRoute() {
  const h = window.location.hash || "";
  return h.startsWith("#/app");
}

export default function App() {
  const [showApp, setShowApp] = useState(isAppRoute());

  useEffect(() => {
    const onChange = () => setShowApp(isAppRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // Existing QR links use query params (?...), so send those straight to the app.
  useEffect(() => {
    if (window.location.search && !isAppRoute()) {
      window.location.hash = "#/app";
    }
  }, []);

  return showApp ? <CertApp /> : <Landing />;
}
