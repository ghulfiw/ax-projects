// Supabase connection for the AX Project Tracker.
// Find both values in Supabase: Project Settings > API (or "Connect" at the top of the dashboard).
// The anon / publishable key is meant to be public: the row-level security rules in
// supabase/schema.sql decide who can see and change what. Never put the service_role / secret key here.
window.AX_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabaseAnonKey: "YOUR-ANON-OR-PUBLISHABLE-KEY"
};
