# Fairway Friends

A fun, lightweight golf scorecard for friends' rounds in Malaysia. Pick a game, share a QR code so
everyone can join and score live, then settle bets and split the meal bill.

- Games: Stroke Play, Stableford, Match Play, Team Best Ball, Scramble, plus a Custom Game builder.
- Anyone in a round can enter or edit any score; every change records who made it.
- Handicap = strokes given for the round (net = gross − handicap). No course/slope rating.
- Settle up: pot split by %, or RM per stroke/point; meal split equal / loser pays / by rank % / by gap.

## Layout
- `src/` React + Vite frontend (mobile-first). `backend/` Express API (:8000, `/health`, `/api`).
- `backend/engine/` pure game + settlement logic with tests: `npm test`.
- `backend/resources/db/migration/` Flyway migrations (additive only). `backend/seed/courses.json` seed courses.

## Local dev
Needs a MySQL-wire DB (never SQLite): `docker compose up -d db && docker compose run --rm migrate`,
then `DATABASE_URL=mysql://root:root@localhost:3306/app node backend/server.js` and `npm run dev`.
