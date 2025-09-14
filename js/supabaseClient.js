
const SUPABASE_URL = 'https://xaxhydeqepugpzndgmwb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhheGh5ZGVxZXB1Z3B6bmRnbXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NjM3MjcsImV4cCI6MjA3MzIzOTcyN30.8Gz_3tVGKQLdF6GlfdMa8dWZ9XOPzPfO3b2wkRS7V3Y';

let supabase;
function getSupabase() {
  if (!supabase) {
    // globalThis.supabase is provided by the CDN script
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 5 } }
    });
  }
  return supabase;
}


