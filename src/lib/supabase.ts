import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'dummy-key';

// Buat instance Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
