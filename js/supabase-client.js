// ============================================================
// TENERIFE GLOW RITUAL — Supabase Client
// ============================================================
// IMPORTANT: Replace the two placeholders below with your
// actual Supabase credentials before uploading to GitHub.
// Find them in: Supabase Dashboard → Settings → API
// ============================================================

const SUPABASE_URL  = 'https://xkbxwdtioduklzlrhxhs.supabase.co';   // e.g. https://xxxxxxxxxxx.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYnh3ZHRpb2R1a2x6bHJoeGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk2NzEsImV4cCI6MjA5MTc0NTY3MX0.RfmbnIEm7Oa52ZskPGedUQiOAQHC8P3LhX2P4C8ZPkY';      // starts with eyJ...

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON);

window.supabaseClient = supabaseClient;
