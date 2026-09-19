import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://hurchbtvwjrdxovkswjd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tZEFxppT7q0kC0JpJo_wYw_-WIKPJCm";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
