# Fairway Friends

Golf scoring app for friends' rounds in Malaysia. React/Vite SPA in `src/`; API is a Supabase Edge Function
(`supabase/functions/api/`); Postgres schema in `supabase/migrations/`. Repo: github.com/ninjavanchong/fairway-friends
(master, push directly). **Deploys to Supabase (project ref hcjklyndsoyjhgpildrz) + GitHub Pages. NOT Substrait.**

- Website: GitHub Pages at https://ninjavanchong.github.io/fairway-friends/ (workflow `.github/workflows/pages.yml`, base path /fairway-friends/).
  The API URL is baked in at build time via VITE_API_BASE (public, not a secret).
- API: no sign-in (verify_jwt = false in supabase/config.toml). The function reads SUPABASE_DB_URL (auto-provided).
  Tables have RLS on with no policies, so only the function can touch data.
- Game + money logic is pure and tested: `supabase/functions/api/engine/` (`npm test`). Handicap = strokes for the round.
- Migrations are additive; never edit one that already ran. Course seed is migration 20261006000100.
- Local run: build with `npm run build:web`, then `DATABASE_URL=postgres://... node scripts/dev-server.mjs` (needs a local Postgres).
- Bash heredocs collapse backslashes: write code containing them with Write/Edit.
