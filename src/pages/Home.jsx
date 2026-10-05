import { Link } from "react-router-dom";
import { getRecent } from "../identity.js";

export default function Home() {
  const recent = getRecent();
  return (
    <div>
      <div className="hero">
        <svg className="flag" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M24 8v44" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M24 8l22 8-22 9z" fill="#e8453c" />
          <ellipse cx="32" cy="54" rx="22" ry="5" fill="#0f4a27" opacity=".55" />
          <circle cx="44" cy="50" r="4.5" fill="#fff" />
        </svg>
        <h1>Fairway Friends</h1>
        <p>Score your round, play the game, split the bill.</p>
        <div className="hero-actions">
          <Link className="btn alt block" to="/new">⛳ Start a round</Link>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h3>Your recent rounds</h3>
          <div className="list">
            {recent.map(r => (
              <Link key={r.code} to={`/r/${r.code}`} className="li" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="grow">
                  <div className="name">{r.course}</div>
                  <div className="small muted">{new Date(r.at).toLocaleDateString([], { day: "numeric", month: "short" })}</div>
                </div>
                <span className="codechip">{r.code}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card sand small">
        <b>How it works</b>
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>Pick your course and a game.</li>
          <li>Friends scan your QR code (or open your link) to join.</li>
          <li>Everyone enters scores. The leaderboard updates live.</li>
          <li>After the round, see who owes who and split the meal.</li>
        </ol>
      </div>
    </div>
  );
}
