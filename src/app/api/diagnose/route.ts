import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');

    if (secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const diagnostics: any = {
        supabase: { status: 'checking', message: '' },
        gemini: { status: 'checking', message: '' },
        fal: { status: 'checking', message: '' },
        telegram: { status: 'checking', message: '' },
        logs: [],
        chats: []
    };

    // 1. Diagnose Supabase
    try {
        const start = Date.now();
        // Coba query metadata
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (error) throw error;
        diagnostics.supabase = { 
            status: 'success', 
            message: `Koneksi berhasil. Terdeteksi ${count || 0} user terdaftar. (${Date.now() - start}ms)` 
        };
    } catch (error: any) {
        diagnostics.supabase = { status: 'error', message: `Gagal query ke database: ${error.message}` };
    }

    // 2. Diagnose Gemini
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            diagnostics.gemini = { status: 'error', message: 'GEMINI_API_KEY tidak dikonfigurasi di Env!' };
        } else {
            const start = Date.now();
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Katakan 'OK' jika kamu aktif.");
            const text = result.response.text().trim();
            diagnostics.gemini = { 
                status: 'success', 
                message: `Gemini aktif. Response: "${text}" (${Date.now() - start}ms)` 
            };
        }
    } catch (error: any) {
        diagnostics.gemini = { status: 'error', message: `Gagal memanggil Gemini API: ${error.message}` };
    }

    // 3. Diagnose Fal.ai
    if (process.env.FAL_KEY) {
        diagnostics.fal = { status: 'success', message: 'FAL_KEY terkonfigurasi.' };
    } else {
        diagnostics.fal = { status: 'error', message: 'FAL_KEY tidak dikonfigurasi di Env!' };
    }

    // 4. Diagnose Telegram Bot Token
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            diagnostics.telegram = { status: 'error', message: 'TELEGRAM_BOT_TOKEN tidak dikonfigurasi di Env!' };
        } else {
            const start = Date.now();
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const data = await res.json();
            if (data.ok) {
                diagnostics.telegram = { 
                    status: 'success', 
                    message: `Bot Aktif: @${data.result.username} (${data.result.first_name}) (${Date.now() - start}ms)` 
                };
            } else {
                diagnostics.telegram = { status: 'error', message: `Telegram menolak token: ${data.description}` };
            }
        }
    } catch (error: any) {
        diagnostics.telegram = { status: 'error', message: `Gagal menghubungi API Telegram: ${error.message}` };
    }

    // 5. Ambil 50 Logs Terakhir
    try {
        const { data, error } = await supabase.from('bot_logs').select('*').order('created_at', { ascending: false }).limit(50);
        if (!error) {
            diagnostics.logs = data || [];
        } else {
            diagnostics.logs = [{ id: 0, level: 'ERROR', event: 'DB Fetch Fail', details: error.message, created_at: new Date().toISOString() }];
        }
    } catch (error: any) {
        diagnostics.logs = [{ id: 0, level: 'ERROR', event: 'Logger DB Table Missing', details: error.message, created_at: new Date().toISOString() }];
    }

    // 6. Ambil 20 Percakapan Terakhir
    try {
        const { data, error } = await supabase.from('chat_history').select('*').order('created_at', { ascending: false }).limit(20);
        if (!error) {
            diagnostics.chats = data || [];
        }
    } catch (error) {
        // Abaikan
    }

    return NextResponse.json(diagnostics);
}
