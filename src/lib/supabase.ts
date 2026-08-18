import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://zoyxothgwbpgkjnjunis.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_pcl1_JyHihcFSS_klC6aeg_negcaq9L";

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "todoai-auth-v1",
  },
});
