import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { TEAM_KEYS } from "../util.js";

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#1f6b3a" />
      <path d="M26 14v34" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 14l16 6-16 7z" fill="#f4c542" />
      <ellipse cx="32" cy="50" rx="14" ry="4" fill="#0f4a27" />
      <circle cx="40" cy="47" r="4" fill="#fff" />
    </svg>
  );
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="handle" />
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div className="spacer" />
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 54, step = 1, label }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} aria-label="less">−</button>
      <output>{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} aria-label="more">+</button>
    </span>
  );
}

export function TeamChips({ value, onChange, count = 2 }) {
  return (
    <span className="teamchips">
      {TEAM_KEYS.slice(0, count).map(k => (
        <button key={k} type="button" className={`tc-${k} ${value === k ? "on" : ""}`} onClick={() => onChange(value === k ? null : k)} aria-label={`Team ${k}`}>
          {k}
        </button>
      ))}
    </span>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <span className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{label}</button>
      ))}
    </span>
  );
}

export function Explain({ game, lines }) {
  return (
    <div className="explain">
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {game?.example && <div className="eg">e.g. {game.example}</div>}
    </div>
  );
}

export function Confetti({ burst }) {
  const [bits, setBits] = useState([]);
  useEffect(() => {
    if (!burst) return;
    const colors = ["#f4c542", "#e8453c", "#3c9a5a", "#2b7bbb", "#fff"];
    setBits(Array.from({ length: 34 }, (_, i) => ({
      id: `${burst}-${i}`, left: Math.random() * 100, delay: Math.random() * 0.5, color: colors[i % colors.length],
    })));
    const t = setTimeout(() => setBits([]), 2400);
    return () => clearTimeout(t);
  }, [burst]);
  if (!bits.length) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map(b => <i key={b.id} style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s` }} />)}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg ? <div className="toast" role="status">{msg}</div> : null, setMsg];
}

export function QrCode({ url }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0f4a27", light: "#ffffff" } })
      .then(s => { if (live) setSvg(s); })
      .catch(() => {});
    return () => { live = false; };
  }, [url]);
  return <div className="qrbox" role="img" aria-label="QR code to join this round" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function InviteBody({ round, toast }) {
  const url = `${location.origin}/j/${round.code}`;
  const text = `Join our golf round at ${round.courseName} on Fairway Friends ⛳
${url}
(code ${round.code})`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast("Copy not available: long-press the link"); }
  };
  return (
    <>
      <p className="muted center">Scan to join the round. No sign-up, just type your name.</p>
      <QrCode url={url} />
      <div className="center" style={{ marginBottom: 12 }}>
        <span className="codechip">{round.code}</span>
        <div className="small muted" style={{ marginTop: 6, wordBreak: "break-all" }}>{url}</div>
      </div>
      <div className="grid2">
        <button className="btn ghost" onClick={copy}>🔗 Copy link</button>
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
      </div>
    </>
  );
}

export function ShareSheet({ round, onClose, toast }) {
  return (
    <Sheet title="Invite players" onClose={onClose}>
      <InviteBody round={round} toast={toast} />
    </Sheet>
  );
}
