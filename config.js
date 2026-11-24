// Supabase connection for the AX Project Tracker.
// Find both values in Supabase: Project Settings > API (or "Connect" at the top of the dashboard).
// The anon / publishable key is meant to be public: the row-level security rules in
// supabase/schema.sql decide who can see and change what. Never put the service_role / secret key here.
window.AX_CONFIG = {
  supabaseUrl: "https://acpwrefprpreodswvlsc.supabase.co",
  supabaseAnonKey: "sb_publishable_WSMNfIymuXyN-KPYOSqT5w_8VNstADv"
};
