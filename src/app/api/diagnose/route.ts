import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');

    if (secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const diagnostics: any = {
        supabase: { status: 'checking', message: '' },
        mistral: { status: 'checking', message: '' },
        fal: { status: 'checking', message: '' },
        telegram: { status: 'checking', message: '' },
        logs: [],
        chats: []
    };

    // 1. Diagnose Supabase
    try {
        const start = Date.now();
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (error) throw error;
        diagnostics.supabase = { 
            status: 'success', 
            message: `Koneksi berhasil. Terdeteksi ${count || 0} user terdaftar. (${Date.now() - start}ms)` 
        };
    } catch (error: any) {
        diagnostics.supabase = { status: 'error', message: `Gagal query ke database: ${error.message}` };
    }

    // 2. Diagnose Mistral (via Proxy)
    try {
        const proxyUrl = process.env.MISTRAL_API_URL || "https://fatsproxyai.vercel.app/api/mistral";
        const apiKey = process.env.MISTRAL_API_KEY || "";
        
        const headers: any = {
            "Content-Type": "application/json"
        };
        if (apiKey) {
            headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const start = Date.now();
        const res = await fetch(proxyUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [{ role: 'user', content: 'Say OK' }]
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content?.trim() || '';
            diagnostics.mistral = { 
                status: 'success', 
                message: `Mistral via Proxy aktif. Response: "${text}" (${Date.now() - start}ms)` 
            };
        } else {
            const errText = await res.text();
            diagnostics.mistral = { status: 'error', message: `Proxy menolak request (${res.status}): ${errText}` };
        }
    } catch (error: any) {
        diagnostics.mistral = { status: 'error', message: `Gagal memanggil Proxy Mistral: ${error.message}` };
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
