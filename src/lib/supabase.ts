import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// Buat instance Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
