# Fairway Friends

A fun, lightweight golf scorecard for friends' rounds in Malaysia. Pick a game, share a QR code so
everyone can join and score live, then settle bets and split the meal bill.

- Games: Stroke Play, Stableford, Match Play, Team Best Ball, Scramble, plus a Custom Game builder.
- Anyone in a round can enter or edit any score; every change records who made it.
- Handicap = strokes given for the round (net = gross − handicap). No course/slope rating.
- Settle up: pot split by %, or RM per stroke/point; meal split equal / loser pays / by rank % / by gap.

## Layout
- `src/` React + Vite frontend (mobile-first), deployed to GitHub Pages.
- `supabase/functions/api/` Edge Function (REST API) with the game + settlement engine in `engine/` (`npm test`).
- `supabase/migrations/` Postgres schema and course seed.
