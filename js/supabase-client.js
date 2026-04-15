// ============================================================
// TENERIFE GLOW RITUAL — Supabase Client
// ============================================================
// IMPORTANT: Replace the two placeholders below with your
// actual Supabase credentials before uploading to GitHub.
// Find them in: Supabase Dashboard → Settings → API
// ============================================================

const SUPABASE_URL  = 'YOUR_SUPABASE_PROJECT_URL';   // e.g. https://xxxxxxxxxxx.supabase.co
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';      // starts with eyJ...

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON);

window.supabaseClient = supabaseClient;
