// Supabase Edge Function entry point. All logic lives in app.js so it can also run under Node for local dev and tests.
import { handle } from "./app.js";

Deno.serve(handle);
