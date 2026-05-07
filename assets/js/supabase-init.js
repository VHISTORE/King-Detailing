// Supabase client — shared by index.html and admin.html
// Fill in SUPABASE_URL and SUPABASE_ANON_KEY after creating the project.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://yzgtmzdjsnafmhulqrgg.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_yhoygFfFyGmYs_Ap1gpOvg_WQ6shpeO";

export const ADMIN_EMAIL = "vibemusic1712@gmail.com";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
