import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://pdwehqekftzjcbtgupdn.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkd2VocWVrZnR6amNidGd1cGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzA2MzQsImV4cCI6MjEwNTc0NjYzNH0.nQKP0xtpKa3WKMomfzLnJCNi-QnhWW1UeMamFFYfjQs';

export const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
