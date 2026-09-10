import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lajlwesprqzolnsgvoff.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxhamx3ZXNwcnF6b2xuc2d2b2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MjI1MTgsImV4cCI6MjEwNDQ5ODUxOH0.h3RxkP4ECzKR0VbV_PEFQ9E0vqchkR5d4vVOG8rSVuM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);