import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./styles.css";
import { Logo } from "./components/ui.jsx";
import Home from "./pages/Home.jsx";
import NewRound from "./pages/NewRound.jsx";
import Join from "./pages/Join.jsx";
import Round from "./pages/Round.jsx";
import History from "./pages/History.jsx";

function Shell({ children, bare }) {
  return (
    <div className="app">
      {!bare && (
        <div className="topbar">
          <Link to="/" className="brand"><Logo /> Fairway Friends</Link>
        </div>
      )}
      {children}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Shell bare><Home /></Shell>} />
        <Route path="/history" element={<Shell><History /></Shell>} />
        <Route path="/new" element={<Shell><NewRound /></Shell>} />
        <Route path="/j/:code" element={<Shell><Join /></Shell>} />
        <Route path="/r/:code" element={<Shell bare><Round /></Shell>} />
        <Route path="*" element={<Shell><div className="card"><h2>Lost on the course?</h2><Link className="btn" to="/">Back to the clubhouse</Link></div></Shell>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
