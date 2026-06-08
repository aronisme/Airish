import { supabase } from './supabase';

export async function logEvent(
    level: 'INFO' | 'WARN' | 'ERROR', 
    event: string, 
    details: string, 
    telegramId?: number
) {
    // Selalu log ke console terlebih dahulu agar terlihat di Vercel Logs
    const logMsg = `[${level}] ${event} - ${details}`;
    if (level === 'ERROR') {
        console.error(logMsg);
    } else if (level === 'WARN') {
        console.warn(logMsg);
    } else {
        console.log(logMsg);
    }

    try {
        // Coba masukkan ke tabel bot_logs di Supabase
        const { error } = await supabase.from('bot_logs').insert({
            level,
            event,
            details,
            telegram_id: telegramId || null
        });
        if (error) {
            console.error("Gagal menyimpan log ke Supabase:", error.message);
        }
    } catch (err) {
        console.error("Exception saat menulis log ke Supabase:", err);
    }
}
