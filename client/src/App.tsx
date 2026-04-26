import { useState } from "react";
import Home from "./pages/Home";
import History from "./components/History";
import Vehicle from "./components/Vehicle";
import MapView from "./components/MapView";
import Statistics from "./components/Statistics";
import { TrackingProvider } from "./context/TrackingContext";

export default function App() {
  const [tab, setTab] = useState<"home" | "map" | "history" | "stats" | "vehicle">("home");

  return (
    <TrackingProvider>
      <div style={styles.app}>
        <div style={styles.content}>
          {tab === "home" && <Home />}
          {tab === "map" && <MapView />}
          {tab === "history" && <History />}
          {tab === "stats" && <Statistics />}
          {tab === "vehicle" && <Vehicle />}
        </div>

        <div style={styles.nav}>
          <NavButton label="Accueil" active={tab === "home"} onClick={() => setTab("home")} />
          <NavButton label="Carte" active={tab === "map"} onClick={() => setTab("map")} />
          <NavButton label="Trajets" active={tab === "history"} onClick={() => setTab("history")} />
          <NavButton label="Stats" active={tab === "stats"} onClick={() => setTab("stats")} />
          <NavButton label="Véhicule" active={tab === "vehicle"} onClick={() => setTab("vehicle")} />
        </div>
      </div>
    </TrackingProvider>
  );
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navButton,
        ...(active ? styles.navButtonActive : {}),
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "white",
    display: "flex",
    flexDirection: "column" as const,
  },

  content: {
    flex: 1,
    overflow: "auto",
    paddingBottom: "60px",
  },

  nav: {
    height: "60px",
    display: "flex",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "#020617",
    position: "fixed" as const,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },

  navButton: {
    flex: 1,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
    cursor: "pointer",
  },

  navButtonActive: {
    color: "white",
    fontWeight: "bold",
  },
};